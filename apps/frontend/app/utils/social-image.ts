import { buildSocialImage, type SocialImage } from "@fxmk/shared/social-image";
export type { SocialImage } from "@fxmk/shared/social-image";
import type { Media, Meta } from "@fxmk/payload-types";
import { imagekitUrl } from "./imagekit";
import { getAltFromMedia } from "./media";

export type PageMeta = {
  title?: string | null;
  image?: string | Media | null;
  description?: string | null;
};

type SocialImageOptions = {
  meta?: PageMeta | null;
  title?: string | null;
  template?: Meta["socialImageTemplate"];
  environment: { imagekitBaseUrl: string };
  // These dimensions apply only to manual overrides, retaining existing crops.
  width?: number;
  height?: number;
};

export function resolveSocialImage({
  meta,
  title,
  template,
  environment,
  width = 1200,
  height = 630,
}: SocialImageOptions): SocialImage | undefined {
  const manualImage = meta?.image;
  if (isImage(manualImage)) {
    return {
      url: imagekitUrl(environment.imagekitBaseUrl, manualImage.filename!, [
        { width: width.toString(), height: height.toString() },
      ]),
      alt: getAltFromMedia(manualImage),
      width,
      height,
      mimeType: manualImage.mimeType ?? "",
    };
  }

  const baseImage = template?.baseImage;
  const imageTitle = title?.trim() || meta?.title?.trim();
  if (!isImage(baseImage) || !imageTitle) return undefined;

  return buildSocialImage({
    urlEndpoint: environment.imagekitBaseUrl,
    filename: baseImage.filename!,
    title: imageTitle,
    template,
  });
}

function isImage(image: Media | string | null | undefined): image is Media {
  return typeof image === "object" && !!image?.filename;
}
