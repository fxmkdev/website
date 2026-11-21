import { expect, test } from "vitest";
import { meta as pageMeta } from "./page/route";
import { meta as postMeta } from "./post/route";

test.each([
  ["page", pageMeta],
  ["post", postMeta],
] as const)("%s forwards its content title to social previews", (_, meta) => {
  const args = {
    data: {
      canonicalUrl: "https://fxmk.dev/content",
      content: { title: "Content title", meta: { title: "SEO title" } },
    },
    matches: [
      {
        id: "root",
        data: {
          meta: {
            socialImageTemplate: { baseImage: { filename: "base.jpg" } },
          },
          environment: { imagekitBaseUrl: "https://ik.imagekit.io/demo" },
        },
      },
    ],
  };
  const tags = meta(
    args as unknown as Parameters<typeof pageMeta>[0] &
      Parameters<typeof postMeta>[0],
  );
  expect(tags).toEqual(
    expect.arrayContaining([
      { name: "og:image:alt", content: "Content title" },
      { name: "twitter:image:alt", content: "Content title" },
      { title: "SEO title" },
    ]),
  );
});
