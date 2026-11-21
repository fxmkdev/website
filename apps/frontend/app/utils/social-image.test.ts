import type { Media, Meta } from "@fxmk/payload-types";
import { afterEach, expect, test, vi } from "vitest";
import { resolveSocialImage } from "./social-image";

const environment = { imagekitBaseUrl: "https://ik.imagekit.io/demo" };
const template = {
  baseImage: { filename: "base.jpg" } as Media,
} satisfies Meta["socialImageTemplate"];
const options = { title: "Hello world", template, environment };

function overlayText(url: string) {
  const encoded = new URL(url).searchParams.get("tr")!.match(/ie-([^,]+)/)![1];
  return Buffer.from(encoded, "base64").toString("utf8");
}

afterEach(() => vi.unstubAllGlobals());

test("generates a JPEG with default layout and matching image metadata", () => {
  const image = resolveSocialImage(options)!;
  expect(image).toMatchObject({
    alt: "Hello world",
    width: 1200,
    height: 630,
    mimeType: "image/jpeg",
  });
  expect(image.url).toContain("/base.jpg?tr=w-1200,h-630,fo-center,f-jpg:");
  expect(image.url).toContain(
    "ff-Roboto,tg-b,fs-64,co-FFFFFF,w-1056,ia-left,lap-bottom_left,lx-72,ly-N72,l-end",
  );
  expect(overlayText(image.url)).toBe("Hello world");
});

test.each([
  ["top-left", "ia-left,lap-top_left,lx-72,ly-72"],
  ["center", "ia-center,lap-top_left,lxc-600,lyc-315"],
  ["bottom-left", "ia-left,lap-bottom_left,lx-72,ly-N72"],
] as const)("supports %s title styling", (titlePosition, position) => {
  const image = resolveSocialImage({
    ...options,
    template: {
      ...template,
      titlePosition,
      fontSize: 32,
      textColor: "#12abEF",
    },
  })!;
  expect(image.url).toContain("fs-32,co-12abEF");
  expect(image.url).toContain(position);
});

test("manual images win and preserve dimensions, MIME type, and alt text", () => {
  const image = resolveSocialImage({
    ...options,
    width: 2400,
    height: 1200,
    meta: {
      image: {
        filename: "manual.png",
        alt: "Manual alt",
        mimeType: "image/png",
      } as Media,
    },
  });
  expect(image).toEqual({
    url: "https://ik.imagekit.io/demo/manual.png?tr=w-2400,h-1200",
    alt: "Manual alt",
    width: 2400,
    height: 1200,
    mimeType: "image/png",
  });
  expect(
    resolveSocialImage({
      environment,
      meta: { image: { filename: "manual.png" } as Media },
    }),
  ).toBeDefined();
});

test("uses the content title first, then a nonblank SEO title", () => {
  expect(
    resolveSocialImage({ ...options, meta: { title: "SEO title | fxmk.dev" } })
      ?.alt,
  ).toBe("Hello world");
  expect(
    resolveSocialImage({
      ...options,
      title: "  ",
      meta: { title: " SEO title " },
    })?.alt,
  ).toBe("SEO title");
  expect(
    resolveSocialImage({ ...options, title: undefined, meta: undefined }),
  ).toBeUndefined();
  expect(
    resolveSocialImage({ ...options, title: "  ", meta: { title: " " } }),
  ).toBeUndefined();
});

test.each([undefined, null, "unresolved-id", {} as Media])(
  "omits missing or unresolved template media: %s",
  (baseImage) => {
    expect(
      resolveSocialImage({ ...options, template: { baseImage } }),
    ).toBeUndefined();
  },
);

test.each([undefined, null, "unresolved-id", {} as Media])(
  "generates when manual media is missing or unresolved: %s",
  (image) => {
    expect(resolveSocialImage({ ...options, meta: { image } })?.url).toContain(
      "/base.jpg?",
    );
    expect(
      resolveSocialImage({ ...options, template: undefined, meta: { image } }),
    ).toBeUndefined();
  },
);

test.each(["Café 🚀", "你好世界", "A, B: 20% & /?", "👨‍👩‍👧‍👦 together"])(
  "encodes %s identically in browser and server contexts",
  (title) => {
    const browserImage = resolveSocialImage({ ...options, title })!;
    expect(overlayText(browserImage.url).replaceAll("\n", " ")).toBe(title);
    vi.stubGlobal("window", undefined);
    expect(resolveSocialImage({ ...options, title })).toEqual(browserImage);
  },
);

test.each([32, 64, 72])(
  "bounds long titles at font size %i without splitting emoji",
  (fontSize) => {
    for (const title of [
      "A very long title with many words. ".repeat(50),
      "W".repeat(1000),
      "👨‍👩‍👧‍👦".repeat(1000),
      "🚀".repeat(1000),
    ]) {
      const image = resolveSocialImage({
        ...options,
        title,
        template: { ...template, fontSize },
      })!;
      const text = overlayText(image.url);
      expect(text.endsWith("…")).toBe(true);
      expect(text.split("\n").length).toBeLessThanOrEqual(
        Math.floor(486 / (fontSize * 1.5)),
      );
      expect(text).not.toContain("�");
      expect(Buffer.byteLength(text, "utf8")).toBeLessThan(1800);
      if (!title.includes(" ")) {
        for (const line of text.split("\n")) {
          expect(Array.from(line).length).toBeLessThanOrEqual(
            Math.floor(1056 / fontSize),
          );
        }
      }
    }
  },
);

test("normalizes whitespace and changes URLs when the template changes", () => {
  const image = resolveSocialImage({ ...options, title: "Hello\n\tworld" })!;
  expect(overlayText(image.url)).toBe("Hello world");
  expect(
    resolveSocialImage({
      ...options,
      template: { ...template, textColor: "#000000" },
    })?.url,
  ).not.toBe(image.url);
  expect(
    resolveSocialImage({
      ...options,
      template: { baseImage: { filename: "new.jpg" } as Media },
    })?.url,
  ).not.toBe(image.url);
});

test("keeps ordinary titles intact without premature truncation", () => {
  const image = resolveSocialImage({
    ...options,
    title: "Building software with care",
  })!;
  expect(overlayText(image.url).replaceAll("\n", " ")).toBe(
    "Building software with care",
  );
  expect(overlayText(image.url).split("\n")).toHaveLength(2);
});
