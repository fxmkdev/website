import type { Meta } from "@fxmk/payload-types";
import {
  resolveSocialImage,
  type PageMeta,
  type SocialImage,
} from "./social-image";
import type { MetaDescriptor } from "react-router";

type Environment = {
  imagekitBaseUrl: string;
};

export function getPageMetaDescriptors(
  canonicalUrl: string | undefined,
  pageMeta: PageMeta | undefined,
  siteMeta: Meta,
  environment: Environment,
  contentTitle?: string | null,
): MetaDescriptor[] {
  const title = pageMeta?.title ?? "";
  const description = pageMeta?.description ?? "";
  const options = {
    meta: pageMeta,
    title: contentTitle,
    template: siteMeta.socialImageTemplate,
    environment,
  };
  const image = resolveSocialImage(options);
  const twitterImage = resolveSocialImage({
    ...options,
    width: 2400,
    height: 1200,
  });
  return [
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { title },
    { name: "description", content: description },
    { name: "og:title", content: title },
    { name: "og:description", content: description },
    ...(siteMeta.locale
      ? [{ name: "og:locale", content: siteMeta.locale }]
      : []),
    { name: "og:type", content: "website" },
    ...(siteMeta.siteName
      ? [{ name: "og:site_name", content: siteMeta.siteName }]
      : []),
    {
      name: "og:url",
      content: canonicalUrl,
    },
    ...getOpenGraphImageMeta(image),
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: title,
    },
    {
      name: "twitter:description",
      content: description,
    },
    ...getTwitterCardImageMeta(twitterImage),
  ];
}

function getTwitterCardImageMeta(image: SocialImage | undefined) {
  if (!image) return [];
  return [
    { name: "twitter:image", content: image.url },
    { name: "twitter:image:alt", content: image.alt },
  ];
}

function getOpenGraphImageMeta(image: SocialImage | undefined) {
  if (!image) return [];
  return [
    { name: "og:image", content: image.url },
    { name: "og:image:alt", content: image.alt },
    { name: "og:image:type", content: image.mimeType },
    { name: "og:image:width", content: image.width.toString() },
    { name: "og:image:height", content: image.height.toString() },
  ];
}
