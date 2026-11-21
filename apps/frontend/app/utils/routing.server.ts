import { redirect } from "react-router";
import {
  toRelativeUrl,
  getRequestUrl,
  getCanonicalRequestUrl,
} from "../utils/routing";
import { tryGetPage, tryGetRedirect } from "./cms-data.server";
import { getLinkHref } from "./links";

export async function handleIncomingRequest(request: Request, routeUrl: URL) {
  const url = getRequestUrl(request, routeUrl);

  redirectIfNonCanonicalHostname(request, routeUrl);
  redirectIfPathnameEndsWithSlash(url);

  const pageUrl = toRelativeUrl(url);
  console.log(pageUrl);

  // maintenance screen
  // const maintenance = await getMaintenance(locale);
  // if (
  //   maintenance.maintenanceScreen?.show &&
  //   !(await isAuthenticated(request)) &&
  //   pageUrl !== "/login"
  // ) {
  //   throw new Response(null, {
  //     status: 503,
  //     statusText: "Service Unavailable",
  //   });
  // }

  return { pageUrl };
}

function redirectIfNonCanonicalHostname(request: Request, routeUrl: URL) {
  const canonicalRequestUrl = getCanonicalRequestUrl(request, routeUrl);
  if (
    getRequestUrl(request, routeUrl).hostname !== canonicalRequestUrl.hostname
  ) {
    throw redirect(canonicalRequestUrl.href, { status: 301 });
  }
}

function redirectIfPathnameEndsWithSlash(url: URL) {
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
    throw redirect(toRelativeUrl(url), { status: 301 });
  }
}

export async function handlePathname(pathname: string) {
  const content = await tryGetPage(pathname);
  if (content) return content;

  const redirectObj = await tryGetRedirect(pathname);
  if (redirectObj && redirectObj.to) {
    throw redirect(getLinkHref(redirectObj.to), { status: 301 });
  }

  throw new Response(null, { status: 404, statusText: "Not Found" });
}
