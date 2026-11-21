import { getCanonicalRequestUrl } from "~/utils/routing";
import type { Route } from "./+types/route";
import { getMeta, getPosts, tryGetPage } from "~/utils/cms-data.server";
import { parseISO, format } from "date-fns";
import { getSocialImageUrl } from "~/utils/page-meta";
import { getEnvironment } from "~/utils/environment.server";
import type { Media, Post } from "@fxmk/payload-types";

const rssDateFormat = "eee, dd MMM yyyy HH:mm:ss xx";
const rssImageWidth = 1200;
const rssImageHeight = 630;

export async function loader({ request, url }: Route.LoaderArgs) {
  const [meta, page, posts] = await Promise.all([
    getMeta(),
    tryGetPage("/articles"),
    getPosts(1),
  ]);

  if (!page) throw new Response(null, { status: 404, statusText: "Not Found" });
  const environment = getEnvironment(request, url);

  const channelLastChanged = posts
    .map((p) => p.publishedAt)
    .filter((d) => !!d)
    .map((d) => format(parseISO(d!), rssDateFormat));

  const content = `<?xml version="1.0" encoding="UTF-8"?>
     <rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:webfeeds="http://webfeeds.org/rss/1.0" version="2.0">
       <channel>
         <title>${meta.siteName ?? ""}</title>
         <link>${getCanonicalUrl(request, url, "/articles")}</link>
         <description>${page.meta?.description}</description>
         <language>en</language>
         <ttl>60</ttl>
         <lastBuildDate>${channelLastChanged}</lastBuildDate>
         <atom:link href="${getCanonicalRequestUrl(request, url)}" rel="self" type="application/rss+xml" />
         <webfeeds:cover image="${getSocialImageUrl(page.meta!, 2400, 1260, environment)}" />
         <webfeeds:icon>${getCanonicalUrl(request, url, "/favicon-96x96.png")}</webfeeds:icon>
         <webfeeds:logo>${getCanonicalUrl(request, url, "/favicon.svg")}</webfeeds:logo>
         <webfeeds:accentColor>#2dd4bf</webfeeds:accentColor>
         ${posts
           .map((post) => {
             const { title, content_summary, publishedAt, slug } = post;
             return `
           <item>
             <title>${cdata(title)}</title>
             <description>${cdata(content_summary ?? "")}</description>
             ${publishedAt ? `<pubDate>${format(parseISO(publishedAt), rssDateFormat)}</pubDate>` : ""}
             <link>${getCanonicalUrl(request, url, `/articles/${slug}`)}</link>
             <guid>${getCanonicalUrl(request, url, `/articles/${slug}`)}</guid>
             ${getItemImageTags(post, environment)}
           </item>`;
           })
           .join("")}
       </channel>
     </rss>`;
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml",
      encoding: "UTF-8",
    },
  });
}

function getCanonicalUrl(request: Request, routeUrl: URL, pathname: string) {
  const url = getCanonicalRequestUrl(request, routeUrl);
  url.pathname = pathname;
  return url.toString();
}

function cdata(s: string) {
  return `<![CDATA[${s}]]>`;
}

function getItemImageTags(
  post: Post,
  environment: ReturnType<typeof getEnvironment>,
) {
  const image = post.meta?.image;
  if (!isMedia(image)) return "";

  const imageUrl = getSocialImageUrl(
    { image },
    rssImageWidth,
    rssImageHeight,
    environment,
  );
  const type = image.mimeType ?? "";

  return `<media:content url="${imageUrl}" medium="image" type="${type}" width="${rssImageWidth}" height="${rssImageHeight}" />
             <media:thumbnail url="${imageUrl}" width="${rssImageWidth}" height="${rssImageHeight}" />`;
}

function isMedia(image: Media | string | null | undefined): image is Media {
  return typeof image === "object" && !!image?.filename;
}
