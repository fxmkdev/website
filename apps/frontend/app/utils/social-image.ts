import type { Media, Meta } from "@fxmk/payload-types";
import { imagekitUrl } from "./imagekit";
import { getAltFromMedia } from "./media";

export type PageMeta = {
  title?: string | null;
  image?: string | Media | null;
  description?: string | null;
};

export type SocialImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  mimeType: string;
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

  const fontSize = Math.max(32, Math.min(72, template?.fontSize ?? 64));
  const text = fitTitle(imageTitle, fontSize);
  // Encode UTF-8 explicitly: the SDK's browser base64 path uses Latin-1 btoa.
  const encodedText = encodeURIComponent(
    btoa(
      Array.from(new TextEncoder().encode(text), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    ),
  );
  const color = /^#[0-9a-f]{6}$/i.test(template?.textColor ?? "")
    ? template!.textColor!.slice(1)
    : "FFFFFF";
  const position = template?.titlePosition ?? "bottom-left";
  const offsets =
    position === "center"
      ? "lfo-center"
      : position === "top-left"
        ? "lfo-top_left,lx-72,ly-72"
        : "lfo-bottom_left,lx-72,ly-N72";

  return {
    url: imagekitUrl(environment.imagekitBaseUrl, baseImage.filename!, [
      { width: "1200", height: "630", focus: "center", format: "jpg" },
      {
        raw: `l-text,ie-${encodedText},ff-Roboto,tg-b,fs-${fontSize},co-${color},w-1056,ia-${position === "center" ? "center" : "left"},${offsets},l-end`,
      },
    ]),
    alt: imageTitle,
    width: 1200,
    height: 630,
    mimeType: "image/jpeg",
  };
}

function isImage(image: Media | string | null | undefined): image is Media {
  return typeof image === "object" && !!image?.filename;
}

function fitTitle(title: string, fontSize: number) {
  // Use conservative Roboto widths, including fallback glyphs in joined emoji.
  // Explicit wrapping also bounds long unbroken strings; keep emoji intact.
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const encoder = new TextEncoder();
  let bytes = 0;
  let truncated = false;
  const characters = Array.from(
    segmenter.segment(title.replace(/\s+/gu, " ").trim()),
    ({ segment }) => segment,
  ).filter((character) => {
    bytes += encoder.encode(character).length;
    // Leave room for line breaks and an ellipsis under ImageKit's base64 limit.
    if (bytes > 1200) {
      truncated = true;
      return false;
    }
    return true;
  });
  if (truncated) characters.push("…");
  const maxColumns = Math.floor(1056 / fontSize);
  const maxLines = Math.floor(486 / (fontSize * 1.5));
  const lines: string[] = [];
  while (characters.length && lines.length < maxLines) {
    let count = 0;
    let columns = 0;
    while (count < characters.length) {
      const width = titleCharacterWidth(characters[count]);
      if (columns + width > maxColumns) break;
      columns += width;
      count++;
    }
    if (
      count < characters.length &&
      (lines.length === maxLines - 1 || count === 0)
    ) {
      // Reserve space for the ellipsis without splitting a grapheme.
      while (columns + titleCharacterWidth("…") > maxColumns && count > 0) {
        columns -= titleCharacterWidth(characters[--count]);
      }
      lines.push(characters.slice(0, count).join("").trimEnd() + "…");
      break;
    }
    if (characters.length > count && characters[count] !== " ") {
      const space = characters.slice(0, count).lastIndexOf(" ");
      if (space > 0) count = space;
    }
    lines.push(characters.splice(0, count).join("").trim());
    while (characters[0] === " ") characters.shift();
  }
  return lines.join("\n");
}

function titleCharacterWidth(grapheme: string) {
  // Upper bounds in ems for bold Roboto. Unknown Unicode gets two ems,
  // so an unsupported joined emoji reserves room for every fallback glyph.
  return Array.from(grapheme).reduce((width, character) => {
    if (character === " ") return width + 0.35;
    if (/^[ijlI.,:;'!|]$/.test(character)) return width + 0.4;
    if (/^[a-z0-9]$/.test(character) && !/[mw]/.test(character))
      return width + 0.7;
    if (/^[A-Z]$/.test(character) && !/[MW]/.test(character))
      return width + 0.85;
    return width + (character.codePointAt(0)! > 127 ? 2 : 1);
  }, 0);
}
