import { test, expect } from "@playwright/test";
import { createPage, createPost } from "../common/cms";
import { heading, richTextRoot, text } from "@fxmk/shared";

test("has title and heading", async ({ page }) => {
  const testPage = await createPage({
    title: "E2E Test Page",
    meta: {
      title: "E2E Test Page",
    },
    hero: {
      richText: richTextRoot(heading("h1", text("E2E Test Page"))),
    },
  });

  await page.goto(testPage.pathname);

  await expect(page).toHaveTitle(/E2E Test Page/);

  await expect(
    page.getByRole("heading", { level: 1, name: "E2E Test Page" }),
  ).toBeVisible();
});

test("frontend version endpoint returns version", async ({ request }) => {
  const response = await request.get("/version");
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data.version).toBe(process.env.EXPECTED_VERSION);
});

test("robots.txt contains correct sitemap link", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBeTruthy();

  const data = await response.text();
  const canonicalUrl = new URL(process.env.FRONTEND_BASE_URL!);
  canonicalUrl.hostname =
    process.env.CANONICAL_HOSTNAME ?? "canonical.localhost";
  expect(data).toContain(
    `Sitemap: ${new URL("/sitemap.xml", canonicalUrl).href}`,
  );
});

test("sitemap.xml contains page and post URLs with correct lastmod dates", async ({
  request,
}) => {
  const testPage = await createPage({
    publishedAt: "2025-01-01T00:00:00Z",
  });
  const testPost = await createPost({
    publishedAt: "2025-01-07T00:00:00Z",
  });

  const canonicalUrl = new URL(process.env.FRONTEND_BASE_URL!);
  canonicalUrl.hostname =
    process.env.CANONICAL_HOSTNAME ?? "canonical.localhost";
  const canonicalOrigin = canonicalUrl.origin;
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();

  const data = await response.text();
  expect(data).toContain(
    `<url>
    <loc>${canonicalOrigin}${testPage.pathname}</loc>
    <lastmod>2025-01-01</lastmod>
  </url>`,
  );
  expect(data).toContain(
    `<url>
    <loc>${canonicalOrigin}/articles/${testPost.slug}</loc>
    <lastmod>2025-01-07</lastmod>
  </url>`,
  );
});
