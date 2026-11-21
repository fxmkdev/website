import { type Location } from "react-router";

export function getRequestUrl(request: Request, url: URL) {
  const requestUrl = new URL(url);
  if (request.headers.get("X-Forwarded-Proto") === "https") {
    requestUrl.protocol = "https";
  }

  return requestUrl;
}

export function getCanonicalRequestUrl(request: Request, routeUrl: URL) {
  if (!process.env.CANONICAL_HOSTNAME) {
    throw new Error("Missing CANONICAL_HOSTNAME");
  }
  const url = getRequestUrl(request, routeUrl);
  url.hostname = process.env.CANONICAL_HOSTNAME;
  return url;
}

export function toRelativeUrl(urlOrLocation: URL | Location) {
  if (urlOrLocation instanceof URL) {
    return urlOrLocation.toString().replace(urlOrLocation.origin, "");
  }

  return urlOrLocation.pathname + urlOrLocation.search + urlOrLocation.hash;
}

export function toUrl(relativeUrl: string, baseUrl?: string) {
  return new URL(relativeUrl, baseUrl || "http://dummy");
}
