import { beforeEach, expect, test, vi } from "vitest";

import { getMeta, getPosts, tryGetPage } from "~/utils/cms-data.server";
import { loader } from "./route";

vi.mock("~/utils/cms-data.server", () => ({
  getMeta: vi.fn(),
  getPosts: vi.fn(),
  tryGetPage: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getMeta).mockResolvedValue({
    siteName: "fxmk.dev",
  } as Awaited<ReturnType<typeof getMeta>>);
  vi.mocked(tryGetPage).mockResolvedValue({
    meta: {
      description: "Articles",
      image: {
        filename: "articles-cover.jpg",
        mimeType: "image/jpeg",
      },
    },
  } as Awaited<ReturnType<typeof tryGetPage>>);
  vi.mocked(getPosts).mockResolvedValue([
    {
      title: "Post with image",
      content_summary: "Summary",
      publishedAt: "2026-05-22T10:00:00.000Z",
      slug: "post-with-image",
      meta: {
        image: {
          filename: "post-cover.jpg",
          mimeType: "image/jpeg",
        },
      },
    },
    {
      title: "Post without image",
      content_summary: "No image",
      publishedAt: "2026-05-21T10:00:00.000Z",
      slug: "post-without-image",
      meta: {},
    },
  ] as Awaited<ReturnType<typeof getPosts>>);

  process.env.CANONICAL_HOSTNAME = "fxmk.dev";
  process.env.IMAGEKIT_BASE_URL = "https://ik.imagekit.io/fxmk";
});

test("adds Media RSS image tags for posts with SEO images", async () => {
  const response = await loader({
    request: new Request("https://example.com/articles/rss.xml"),
    url: new URL("https://example.com/articles/rss.xml"),
  } as Parameters<typeof loader>[0]);
  const content = await response.text();

  expect(getPosts).toHaveBeenCalledWith(1);
  expect(content).toContain('xmlns:media="http://search.yahoo.com/mrss/"');
  expect(content).toContain(
    '<media:content url="https://ik.imagekit.io/fxmk/post-cover.jpg?tr=w-1200,h-630" medium="image" type="image/jpeg" width="1200" height="630" />',
  );
  expect(content).toContain(
    '<media:thumbnail url="https://ik.imagekit.io/fxmk/post-cover.jpg?tr=w-1200,h-630" width="1200" height="630" />',
  );
  expect(content.match(/<media:content/g)).toHaveLength(1);
  expect(content.match(/<media:thumbnail/g)).toHaveLength(1);
});
