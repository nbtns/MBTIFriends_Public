const FALLBACK_SHARE_BASE = "https://example.com/open";

export function resolveShareBase(configuredBase?: string, browserOrigin?: string) {
  if (configuredBase?.trim()) {
    const parsed = new URL(configuredBase.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/open" || parsed.search || parsed.hash) {
      throw new Error("VITE_PUBLIC_SHARE_BASEにはHTTPSの /open URLを指定してください");
    }
    return parsed.href;
  }
  if (browserOrigin) {
    const parsed = new URL(browserOrigin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return new URL("/open", parsed.origin).href;
  }
  return FALLBACK_SHARE_BASE;
}
