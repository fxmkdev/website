import { getCanonicalRequestUrl } from "~/utils/routing";
import { type LoaderFunctionArgs } from "react-router";
import { getPages, getPosts } from "~/utils/cms-data.server";

export async function loader({ request, url }: LoaderFunctionArgs) {
  const [pages, posts] = await Promise.all([getPages(), getPosts()]);

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${getCanonicalRequestUrl(request, url).origin}${p.pathname}</loc>
    <lastmod>${p.publishedAt?.split("T")[0]}</lastmod>
  </url>`,
  )
  .join("\n")}
${posts
  .map(
    (p) => `  <url>
    <loc>${getCanonicalRequestUrl(request, url).origin}/articles/${p.slug}</loc>
    <lastmod>${p.publishedAt?.split("T")[0]}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      encoding: "UTF-8",
    },
  });
}
