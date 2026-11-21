import { getCanonicalRequestUrl } from "~/utils/routing";
import type { Route } from "./+types/route";
import { getMeta, getPosts, tryGetPage } from "~/utils/cms-data.server";
import { parseISO, format } from "date-fns";
import { resolveSocialImage, type SocialImage } from "~/utils/social-image";
import { getEnvironment } from "~/utils/environment.server";
import type { Meta, Post } from "@fxmk/payload-types";

const rssDateFormat = "eee, dd MMM yyyy HH:mm:ss xx";
const rssImageWidth = 1200;
const rssImageHeight = 630;

export async function loader({ request }: Route.LoaderArgs) {
  const [meta, page, posts] = await Promise.all([
    getMeta(),
    tryGetPage("/articles"),
    getPosts(1),
  ]);

  if (!page) throw new Response(null, { status: 404, statusText: "Not Found" });
  const environment = getEnvironment(request);

  const cover = resolveSocialImage({
    meta: page.meta,
    title: page.title,
    template: meta.socialImageTemplate,
    environment,
    width: 2400,
    height: 1260,
  });

  const channelLastChanged = posts
    .map((p) => p.publishedAt)
    .filter((d) => !!d)
    .map((d) => format(parseISO(d!), rssDateFormat));

  const content = `<?xml version="1.0" encoding="UTF-8"?>
     <rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:webfeeds="http://webfeeds.org/rss/1.0" version="2.0">
       <channel>
         <title>${meta.siteName ?? ""}</title>
         <link>${getCanonicalUrl(request, "/articles")}</link>
         <description>${page.meta?.description}</description>
         <language>en</language>
         <ttl>60</ttl>
         <lastBuildDate>${channelLastChanged}</lastBuildDate>
         <atom:link href="${getCanonicalRequestUrl(request)}" rel="self" type="application/rss+xml" />
         ${cover ? `<webfeeds:cover image="${xmlAttribute(cover.url)}" />` : ""}
         <webfeeds:icon>${getCanonicalUrl(request, "/favicon-96x96.png")}</webfeeds:icon>
         <webfeeds:logo>${getCanonicalUrl(request, "/favicon.svg")}</webfeeds:logo>
         <webfeeds:accentColor>#2dd4bf</webfeeds:accentColor>
         ${posts
           .map((post) => {
             const { title, content_summary, publishedAt, slug } = post;
             return `
           <item>
             <title>${cdata(title)}</title>
             <description>${cdata(content_summary ?? "")}</description>
             ${publishedAt ? `<pubDate>${format(parseISO(publishedAt), rssDateFormat)}</pubDate>` : ""}
             <link>${getCanonicalUrl(request, `/articles/${slug}`)}</link>
             <guid>${getCanonicalUrl(request, `/articles/${slug}`)}</guid>
             ${getItemImageTags(post, meta, environment)}
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

function getCanonicalUrl(request: Request, pathname: string) {
  const url = getCanonicalRequestUrl(request);
  url.pathname = pathname;
  return url.toString();
}

function cdata(s: string) {
  return `<![CDATA[${s}]]>`;
}

function getItemImageTags(
  post: Post,
  siteMeta: Meta,
  environment: ReturnType<typeof getEnvironment>,
) {
  const image = resolveSocialImage({
    meta: post.meta,
    title: post.title,
    template: siteMeta.socialImageTemplate,
    environment,
    width: rssImageWidth,
    height: rssImageHeight,
  });
  return image ? imageTags(image) : "";
}

function imageTags(image: SocialImage) {
  const imageUrl = xmlAttribute(image.url);
  return `<media:content url="${imageUrl}" medium="image" type="${xmlAttribute(image.mimeType)}" width="${image.width}" height="${image.height}" />
             <media:thumbnail url="${imageUrl}" width="${image.width}" height="${image.height}" />`;
}

function xmlAttribute(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}
