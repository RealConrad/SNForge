export interface UrlOptions {
  /** Instance origin, e.g. "https://dev12345.service-now.com". */
  origin: string;
  /** Wrap the classic page in the Next Experience shell (/now/nav/ui/...). */
  nextExperience: boolean;
}

/**
 * Absolute URL for a classic page path such as "/incident_list.do?sysparm_query=…".
 * Under Next Experience the path becomes one encoded segment of the Polaris shell URL.
 */
export function classicPageUrl(path: string, { origin, nextExperience }: UrlOptions): string {
  const target = nextExperience
    ? `/now/nav/ui/classic/params/target/${encodeURIComponent(path.replace(/^\//, ''))}`
    : path;
  return new URL(target, origin).toString();
}
