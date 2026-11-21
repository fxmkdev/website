import { expect, test } from "vitest";
import {
  buildSocialImage,
  normalizeSocialImageTemplate,
  socialImageAlignment,
  socialImageFonts,
  socialImagePosition,
  socialImagePositions,
  validateSocialImageTemplate,
  type SocialImageTemplateSettings,
} from "@fxmk/shared/social-image";

const input = {
  urlEndpoint: "https://ik.imagekit.io/demo",
  filename: "base.jpg",
  title: "A thoughtful title",
};
const transformation = (template: SocialImageTemplateSettings = {}) =>
  new URL(buildSocialImage({ ...input, template })!.url).searchParams.get(
    "tr",
  )!;
const text = (tr: string) =>
  Buffer.from(tr.match(/ie-([^,]+)/)![1], "base64").toString("utf8");

test("legacy settings retain their fonts, text area, and alignment", () => {
  expect(normalizeSocialImageTemplate()).toMatchObject({
    fontFamily: "Roboto",
    fontWeight: "bold",
    fontSize: 64,
    titlePosition: "bottom-left",
    width: 1056,
    height: 486,
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
  });
  for (const titlePosition of ["top-left", "center", "bottom-left"]) {
    expect(buildSocialImage({ ...input, template: { titlePosition } })).toEqual(
      buildSocialImage({
        ...input,
        template: {
          titlePosition,
          fontFamily: "Roboto",
          fontWeight: "bold",
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
      }),
    );
  }
});

test.each(socialImageFonts)(
  "supports regular and bold $label",
  ({ value: fontFamily }) => {
    for (const fontWeight of ["regular", "bold"]) {
      const tr = transformation({ fontFamily, fontWeight });
      expect(tr).toContain(`ff-${fontFamily}`);
      expect(tr.includes("tg-b")).toBe(fontWeight === "bold");
      expect(text(tr).replaceAll("\n", " ")).toBe(input.title);
    }
  },
);

test.each(socialImagePositions)(
  "aligns %s inside asymmetric margins",
  (titlePosition) => {
    const alignment = socialImageAlignment(titlePosition);
    expect(socialImagePosition(alignment.horizontal, alignment.vertical)).toBe(
      titlePosition,
    );
    const tr = transformation({
      titlePosition,
      margins: { top: 30, right: 160, bottom: 90, left: 40 },
    });
    expect(tr).toContain("w-1000");
    expect(tr).toContain(`ia-${alignment.horizontal}`);
    expect(tr).toContain(
      alignment.horizontal === "center"
        ? "lxc-540"
        : alignment.horizontal === "right"
          ? "lx-N160"
          : "lx-40",
    );
    expect(tr).toContain(
      alignment.vertical === "center"
        ? "lyc-285"
        : alignment.vertical === "bottom"
          ? "ly-N90"
          : "ly-30",
    );
  },
);

test.each([
  { margins: { left: -1 } },
  { margins: { top: 0.5 } },
  { margins: { right: Infinity } },
  { margins: { left: 1100, right: 100 } },
  { margins: { top: 600, bottom: 30 } },
  { fontFamily: "Custom Font" },
  { fontWeight: "light" },
  { fontSize: 31 },
  { fontSize: 73 },
  { titlePosition: "invalid" },
  { textColor: "red" },
])("rejects invalid template settings %j", (template) => {
  expect(validateSocialImageTemplate(template)).toBeTypeOf("string");
  expect(buildSocialImage({ ...input, template })).toBeUndefined();
});

test("the minimum valid rectangle fits one line and an ellipsis", () => {
  const template = {
    fontFamily: "Montserrat",
    fontSize: 64,
    margins: { left: 504, right: 504, top: 267, bottom: 267 },
  };
  expect(validateSocialImageTemplate(template)).toBeUndefined();
  const title = "👨‍👩‍👧‍👦".repeat(1000);
  const tr = new URL(
    buildSocialImage({ ...input, title, template })!.url,
  ).searchParams.get("tr")!;
  expect(text(tr)).toBe("…");
});

test.each(socialImageFonts)(
  "bounds Unicode and wide titles for $label",
  ({ value: fontFamily }) => {
    for (const title of [
      "W".repeat(1000),
      "👨‍👩‍👧‍👦".repeat(1000),
      "Café & code, 20% more joy 🚀 ".repeat(100),
    ]) {
      const image = buildSocialImage({
        ...input,
        title,
        template: {
          fontFamily,
          margins: { left: 300, right: 300, top: 120, bottom: 120 },
        },
      })!;
      const fitted = text(new URL(image.url).searchParams.get("tr")!);
      expect(fitted.endsWith("…")).toBe(true);
      expect(fitted.split("\n").length).toBeLessThanOrEqual(4);
      expect(fitted).not.toContain("�");
      expect(Buffer.byteLength(fitted, "utf8")).toBeLessThan(1800);
      expect(image.alt).toBe(title.trim());
    }
  },
);

test("empty media, endpoint, and sample text do not generate URLs", () => {
  expect(buildSocialImage({ ...input, title: " " })).toBeUndefined();
  expect(buildSocialImage({ ...input, filename: "" })).toBeUndefined();
  expect(buildSocialImage({ ...input, urlEndpoint: "" })).toBeUndefined();
});
