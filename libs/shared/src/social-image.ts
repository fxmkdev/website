import { buildSrc } from "@imagekit/javascript";
import { fitSocialImageTitle } from "./social-image-text";

export const socialImageFonts = [
  { value: "Roboto", label: "Roboto", widthScale: 1 },
  { value: "Open Sans", label: "Open Sans", widthScale: 1.25 },
  { value: "Montserrat", label: "Montserrat", widthScale: 1.25 },
  { value: "Lato", label: "Lato", widthScale: 1.25 },
  { value: "Ubuntu", label: "Ubuntu", widthScale: 1.25 },
  { value: "PT_Serif", label: "PT Serif", widthScale: 1.3 },
] as const;

export const socialImagePositions = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type SocialImagePosition = (typeof socialImagePositions)[number];
export type HorizontalAlignment = "left" | "center" | "right";
export type VerticalAlignment = "top" | "center" | "bottom";
export type SocialImageTemplateSettings = {
  fontFamily?: string | null;
  fontWeight?: string | null;
  fontSize?: number | null;
  textColor?: string | null;
  titlePosition?: string | null;
  margins?: {
    top?: number | null;
    right?: number | null;
    bottom?: number | null;
    left?: number | null;
  } | null;
};
export type SocialImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  mimeType: string;
};

export function socialImageAlignment(position = "bottom-left") {
  const [vertical, horizontal] =
    position === "center" ? ["center", "center"] : position.split("-");
  return {
    horizontal: horizontal as HorizontalAlignment,
    vertical: vertical as VerticalAlignment,
  };
}

export function socialImagePosition(
  horizontal: HorizontalAlignment,
  vertical: VerticalAlignment,
): SocialImagePosition {
  const position = `${vertical}-${horizontal}` as const;
  return position === "center-center" ? "center" : position;
}

export function normalizeSocialImageTemplate(
  settings: SocialImageTemplateSettings = {},
) {
  const fontFamily = settings.fontFamily ?? "Roboto";
  const font = socialImageFonts.find((font) => font.value === fontFamily);
  const margins = {
    top: settings.margins?.top ?? 72,
    right: settings.margins?.right ?? 72,
    bottom: settings.margins?.bottom ?? 72,
    left: settings.margins?.left ?? 72,
  };
  return {
    fontFamily,
    widthScale: font?.widthScale ?? 1,
    fontWeight: settings.fontWeight ?? "bold",
    fontSize: settings.fontSize ?? 64,
    textColor: settings.textColor || "#FFFFFF",
    titlePosition: settings.titlePosition ?? "bottom-left",
    margins,
    width: 1200 - margins.left - margins.right,
    height: 630 - margins.top - margins.bottom,
  };
}

export function validateSocialImageTemplate(
  settings: SocialImageTemplateSettings = {},
): string | undefined {
  const template = normalizeSocialImageTemplate(settings);
  if (!socialImageFonts.some((font) => font.value === template.fontFamily))
    return "Select a supported font.";
  if (!["regular", "bold"].includes(template.fontWeight))
    return "Select regular or bold text.";
  if (
    !Number.isInteger(template.fontSize) ||
    template.fontSize < 32 ||
    template.fontSize > 72
  )
    return "Use a whole font size from 32 to 72 pixels.";
  if (!/^#[0-9a-f]{6}$/i.test(template.textColor))
    return "Use a six-digit hex color, for example #FFFFFF.";
  if (
    !(socialImagePositions as readonly string[]).includes(
      template.titlePosition,
    )
  )
    return "Select a valid title alignment.";
  if (
    Object.values(template.margins).some(
      (margin) => !Number.isInteger(margin) || margin < 0,
    )
  )
    return "Margins must be nonnegative whole pixels.";
  if (
    template.width < Math.ceil(2 * template.widthScale) * template.fontSize ||
    template.height < Math.ceil(1.5 * template.fontSize)
  )
    return "Reduce the margins or font size to leave room for at least one line and an ellipsis.";
}

export function buildSocialImage({
  urlEndpoint,
  filename,
  title,
  template: settings = {},
}: {
  urlEndpoint: string;
  filename: string;
  title: string;
  template?: SocialImageTemplateSettings;
}): SocialImage | undefined {
  if (
    !urlEndpoint ||
    !filename ||
    !title.trim() ||
    validateSocialImageTemplate(settings)
  )
    return undefined;
  const template = normalizeSocialImageTemplate(settings);
  const text = fitSocialImageTitle(title, template);
  // The SDK's browser base64 path uses Latin-1 btoa; encode UTF-8 explicitly.
  const encodedText = encodeURIComponent(
    btoa(
      Array.from(new TextEncoder().encode(text), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    ),
  );
  const { horizontal, vertical } = socialImageAlignment(template.titlePosition);
  const { left, right, top, bottom } = template.margins;
  const anchor = `${vertical === "bottom" ? "bottom" : "top"}_${horizontal === "right" ? "right" : "left"}`;
  const x =
    horizontal === "center"
      ? `lxc-${left + template.width / 2}`
      : `lx-${horizontal === "right" ? `N${right}` : left}`;
  const y =
    vertical === "center"
      ? `lyc-${top + template.height / 2}`
      : `ly-${vertical === "bottom" ? `N${bottom}` : top}`;
  const weight = template.fontWeight === "bold" ? ",tg-b" : "";
  const url = buildSrc({
    urlEndpoint,
    src: filename,
    transformation: [
      { width: "1200", height: "630", focus: "center", format: "jpg" },
      {
        raw: `l-text,ie-${encodedText},ff-${encodeURIComponent(template.fontFamily)}${weight},fs-${template.fontSize},co-${template.textColor.slice(1)},w-${template.width},ia-${horizontal},lap-${anchor},${x},${y},l-end`,
      },
    ],
  });
  return {
    url,
    alt: title.trim(),
    width: 1200,
    height: 630,
    mimeType: "image/jpeg",
  };
}
