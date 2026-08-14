import type { DownloadRecord } from './types';

export type DuplicateConfidence = 'strong' | 'medium' | 'weak';

export interface DuplicateMatch {
  item: DownloadRecord;
  confidence: DuplicateConfidence;
  reasons: string[];
}

const CONFIDENCE_RANK: Record<DuplicateConfidence, number> = {
  strong: 3,
  medium: 2,
  weak: 1,
};

const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'igshid',
  'ref',
  'spm',
]);

const VOLATILE_DOWNLOAD_QUERY_KEYS = new Set([
  'expires',
  'signature',
  'x-amz-signature',
  'x-amz-expires',
  'x-amz-credential',
  'x-amz-date',
  'x-amz-security-token',
]);

export function detectPossibleDuplicates(
  download: DownloadRecord,
  candidates: readonly DownloadRecord[],
): DuplicateMatch[] {
  return candidates
    .filter((candidate) => candidate.id !== download.id)
    .map((candidate) => matchCandidate(download, candidate))
    .filter((match): match is DuplicateMatch => match !== null)
    .sort(compareMatches);
}

export function normalizeDuplicateUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    const keptParams = Array.from(url.searchParams.entries())
      .filter(([key]) => !shouldDropQueryParam(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        const keyCompare = leftKey.localeCompare(rightKey);
        return keyCompare === 0 ? leftValue.localeCompare(rightValue) : keyCompare;
      });

    url.hash = '';
    url.search = '';

    for (const [key, value] of keptParams) {
      url.searchParams.append(key, value);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function matchCandidate(download: DownloadRecord, candidate: DownloadRecord): DuplicateMatch | null {
  const reasons: string[] = [];
  const sameBasename = normalizedBasename(download) === normalizedBasename(candidate);
  const sameExtension = normalizedExtension(download) === normalizedExtension(candidate);
  const sameFilename = sameBasename && sameExtension && normalizedBasename(download) !== '';
  const sameKnownSize = knownSize(download) !== null && knownSize(download) === knownSize(candidate);
  const sameSourceDomain = normalizedDomain(download) !== '' && normalizedDomain(download) === normalizedDomain(candidate);
  const sameSourceUrl = normalizedUrlsMatch(download.url, candidate.url);
  const sameFinalUrl = normalizedUrlsMatch(download.finalUrl, candidate.finalUrl);

  if (sameFilename) {
    reasons.push('Same filename', 'Same extension');
  } else if (sameBasename) {
    reasons.push('Same basename');
  }

  if (sameKnownSize) {
    reasons.push('Same known size');
  }

  if (sameSourceUrl) {
    reasons.push('Same normalized source URL');
  }

  if (sameFinalUrl) {
    reasons.push('Same normalized final URL');
  }

  if (sameSourceDomain && !sameSourceUrl && !sameFinalUrl) {
    reasons.push('Same source domain');
  }

  const confidence = confidenceFor({
    sameFilename,
    sameKnownSize,
    sameSourceDomain,
    sameFinalUrl,
  });

  return confidence ? { item: candidate, confidence, reasons } : null;
}

function confidenceFor(match: {
  sameFilename: boolean;
  sameKnownSize: boolean;
  sameSourceDomain: boolean;
  sameFinalUrl: boolean;
}): DuplicateConfidence | null {
  if (match.sameFinalUrl && match.sameKnownSize) {
    return 'strong';
  }

  if (match.sameFilename && match.sameKnownSize && match.sameSourceDomain) {
    return 'strong';
  }

  if (match.sameFinalUrl) {
    return 'medium';
  }

  if (match.sameFilename && match.sameKnownSize) {
    return 'medium';
  }

  return match.sameFilename ? 'weak' : null;
}

function normalizedUrlsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeDuplicateUrl(left);
  const normalizedRight = normalizeDuplicateUrl(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

function normalizedBasename(download: DownloadRecord): string {
  return download.basename.trim().toLocaleLowerCase();
}

function normalizedExtension(download: DownloadRecord): string {
  return (download.extension ?? '').trim().toLocaleLowerCase();
}

function normalizedDomain(download: DownloadRecord): string {
  return download.sourceDomain.trim().toLocaleLowerCase();
}

function knownSize(download: DownloadRecord): number | null {
  const size = download.fileSize || download.totalBytes;
  return size > 0 ? size : null;
}

function shouldDropQueryParam(key: string): boolean {
  const normalizedKey = key.toLocaleLowerCase();
  return normalizedKey.startsWith('utm_')
    || TRACKING_QUERY_KEYS.has(normalizedKey)
    || VOLATILE_DOWNLOAD_QUERY_KEYS.has(normalizedKey);
}

function compareMatches(left: DuplicateMatch, right: DuplicateMatch): number {
  const confidenceCompare = CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence];
  if (confidenceCompare !== 0) {
    return confidenceCompare;
  }

  const timeCompare = timestampFor(right.item) - timestampFor(left.item);
  if (timeCompare !== 0) {
    return timeCompare;
  }

  return right.item.id - left.item.id;
}

function timestampFor(download: DownloadRecord): number {
  const timestamp = new Date(download.startTime).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
