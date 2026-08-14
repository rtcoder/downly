function hostnameFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function sourceDomainForUrls(
  referrer: string | null | undefined,
  finalUrl: string | null | undefined,
  url: string | null | undefined,
): string {
  return hostnameFromUrl(referrer) ?? hostnameFromUrl(finalUrl) ?? hostnameFromUrl(url) ?? 'unknown';
}
