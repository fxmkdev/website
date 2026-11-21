import { type LoaderFunctionArgs } from "react-router";
import { getCanonicalRequestUrl } from "~/utils/routing";

export async function loader({ request, url }: LoaderFunctionArgs) {
  const content = `User-Agent: *
Disallow: 
Allow: /

Sitemap: ${new URL("/sitemap.xml", getCanonicalRequestUrl(request, url)).href}`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      encoding: "UTF-8",
    },
  });
}
