type SourceLike = {
  sourceDomain?: string | null;
  referrer?: string | null;
  finalUrl?: string | null;
  url?: string | null;
};

export function formatSourceDomain(source: SourceLike): string {
  const storedDomain = cleanDomain(source.sourceDomain);
  if (storedDomain && storedDomain !== 'unknown') {
    return storedDomain;
  }

  return hostnameFromUrl(source.referrer)
    ?? hostnameFromUrl(source.finalUrl)
    ?? hostnameFromUrl(source.url)
    ?? 'Unknown source';
}

function cleanDomain(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim().toLowerCase();
  return trimmedValue ? trimmedValue : null;
}

function hostnameFromUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}
