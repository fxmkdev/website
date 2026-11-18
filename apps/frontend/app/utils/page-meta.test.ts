import type { Media, Meta } from "@fxmk/payload-types";
import { expect, test } from "vitest";
import { getPageMetaDescriptors } from "./page-meta";

const environment = { imagekitBaseUrl: "https://ik.imagekit.io/demo" };
const siteMeta = {
  socialImageTemplate: { baseImage: { filename: "base.jpg" } },
} as Meta;

function descriptors(
  meta: Parameters<typeof getPageMetaDescriptors>[1],
  site = siteMeta,
) {
  return getPageMetaDescriptors(
    "https://fxmk.dev/page",
    meta,
    site,
    environment,
    "Content title",
  );
}

test("adds matching generated Open Graph and Twitter images", () => {
  const tags = descriptors({ title: "SEO title", description: "Description" });
  const og = tags.find((tag) => "name" in tag && tag.name === "og:image");
  expect(og).toMatchObject({ content: expect.stringContaining("/base.jpg?") });
  expect(tags).toEqual(
    expect.arrayContaining([
      { name: "twitter:image", content: (og as { content: string }).content },
      { name: "og:image:width", content: "1200" },
      { name: "og:image:height", content: "630" },
      { name: "og:image:type", content: "image/jpeg" },
      { name: "og:image:alt", content: "Content title" },
      { name: "twitter:image:alt", content: "Content title" },
      { title: "SEO title" },
      { name: "description", content: "Description" },
    ]),
  );
});

test("preserves manual Open Graph and Twitter crops", () => {
  expect(
    descriptors({
      image: {
        filename: "manual.jpg",
        mimeType: "image/jpeg",
        alt: "Manual alt",
      } as Media,
    }),
  ).toEqual(
    expect.arrayContaining([
      {
        name: "og:image",
        content: "https://ik.imagekit.io/demo/manual.jpg?tr=w-1200,h-630",
      },
      {
        name: "twitter:image",
        content: "https://ik.imagekit.io/demo/manual.jpg?tr=w-2400,h-1200",
      },
      { name: "og:image:alt", content: "Manual alt" },
    ]),
  );
});

test("omits image descriptors before template setup without throwing", () => {
  const tags = descriptors({ image: "unresolved-id" }, {} as Meta);
  expect(
    tags.some(
      (tag) => "name" in tag && /^(og|twitter):image/.test(String(tag.name)),
    ),
  ).toBe(false);
});
