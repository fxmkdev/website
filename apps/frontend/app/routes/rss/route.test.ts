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

async function loadFeed() {
  const response = await loader({
    request: new Request("https://example.com/articles/rss.xml"),
  } as Parameters<typeof loader>[0]);
  const content = await response.text();
  const document = new DOMParser().parseFromString(content, "application/xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return { content, document };
}

test("generates RSS cover and item images while retaining manual overrides", async () => {
  vi.mocked(getMeta).mockResolvedValue({
    siteName: "fxmk.dev",
    socialImageTemplate: { baseImage: { filename: "base.jpg" } },
  } as Awaited<ReturnType<typeof getMeta>>);
  vi.mocked(tryGetPage).mockResolvedValue({
    title: "Articles",
    meta: {},
  } as Awaited<ReturnType<typeof tryGetPage>>);
  const { content, document } = await loadFeed();
  const cover = document.getElementsByTagNameNS(
    "http://webfeeds.org/rss/1.0",
    "cover",
  )[0];
  expect(cover.getAttribute("image")).toContain("/base.jpg?");
  const images = document.getElementsByTagNameNS(
    "http://search.yahoo.com/mrss/",
    "content",
  );
  expect(images).toHaveLength(2);
  expect(images[0].getAttribute("url")).toBe(
    "https://ik.imagekit.io/fxmk/post-cover.jpg?tr=w-1200,h-630",
  );
  expect(images[1].getAttribute("url")).toContain("/base.jpg?");
  expect(images[1].getAttribute("type")).toBe("image/jpeg");
  expect(images[1].getAttribute("width")).toBe("1200");
  expect(images[1].getAttribute("height")).toBe("630");
  expect(content.match(/<media:thumbnail/g)).toHaveLength(2);
});

test("omits unavailable RSS images before setup without failing", async () => {
  vi.mocked(tryGetPage).mockResolvedValue({ title: "Articles" } as Awaited<
    ReturnType<typeof tryGetPage>
  >);
  vi.mocked(getPosts).mockResolvedValue([
    { title: "No image", slug: "no-image", meta: { image: "unresolved" } },
  ] as Awaited<ReturnType<typeof getPosts>>);
  const { content } = await loadFeed();
  expect(content).not.toContain("<webfeeds:cover");
  expect(content).not.toContain("<media:content");
});

test("escapes image URLs in RSS attributes and preserves their parsed value", async () => {
  process.env.IMAGEKIT_BASE_URL = "https://ik.imagekit.io/fxmk";
  const url = "https://images.example.com/base.jpg?first=1&second=2";
  vi.mocked(getMeta).mockResolvedValue({
    siteName: "fxmk.dev",
    socialImageTemplate: { baseImage: { filename: url } },
  } as Awaited<ReturnType<typeof getMeta>>);
  vi.mocked(tryGetPage).mockResolvedValue({
    title: "Articles",
    meta: {},
  } as Awaited<ReturnType<typeof tryGetPage>>);
  const { content, document } = await loadFeed();
  expect(content).toContain("first=1&amp;second=2&amp;tr=");
  const cover = document.getElementsByTagNameNS(
    "http://webfeeds.org/rss/1.0",
    "cover",
  )[0];
  expect(cover.getAttribute("image")).toContain("first=1&second=2&tr=");
});
