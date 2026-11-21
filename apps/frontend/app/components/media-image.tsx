import type { Media } from "@fxmk/payload-types";
import { useEnvironment } from "../utils/environment";
import { useMemo } from "react";
import { imagekitImageSources, type ImageCrop } from "~/utils/imagekit";
import { selectImageFromMedia } from "~/utils/media-image";

type MediaImageProps = {
  media: Media | string;
  preferredSize: ImageSize;
  crop?: ImageCrop;
} & Omit<
  React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  >,
  "alt" | "src" | "srcSet"
>;

export function MediaImage({
  media,
  preferredSize = "large",
  crop,
  ...props
}: MediaImageProps) {
  if (typeof media !== "object") return null;

  const imageMeta = selectImageFromMedia(media, preferredSize);

  const sources = useImageSources(imageMeta, crop);
  if (!sources) return null;

  return (
    <img
      src={sources.src}
      srcSet={sources.srcSet}
      alt={media.alt ?? undefined}
      width={imageMeta.width ?? undefined}
      height={imageMeta.height ?? undefined}
      {...props}
    />
  );
}

function useImageSources(
  imageMeta: ImageMeta | undefined | null,
  crop: ImageCrop | undefined,
) {
  const { imagekitBaseUrl } = useEnvironment();
  const sources = useMemo(
    () =>
      imageMeta?.filename
        ? imagekitImageSources(imagekitBaseUrl, imageMeta.filename, crop, {
            width: imageMeta.width,
            height: imageMeta.height,
          })
        : null,
    [
      crop,
      imageMeta?.filename,
      imageMeta?.height,
      imageMeta?.width,
      imagekitBaseUrl,
    ],
  );

  return sources;
}

export type ImageSize = keyof NonNullable<Media["sizes"]>;

type ImageMeta = {
  filename?: string | null;
  width?: number | null;
  height?: number | null;
};
