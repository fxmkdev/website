import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  create,
  createPage,
  createPost,
  get,
  getOrCreate,
  update,
} from "../common/cms";
import { heading, richTextRoot, text } from "@fxmk/shared";
import { sendPreviewUpdate } from "../common/live-preview";

test.describe.configure({ mode: "serial" });
const frontendUrl = new URL(process.env.FRONTEND_BASE_URL!);
frontendUrl.hostname = process.env.CANONICAL_HOSTNAME ?? "canonical.localhost";
const canonicalOrigin = frontendUrl.origin;

async function setLinks(request: APIRequestContext, links: [string, string][]) {
  const root = await get("pages?where[pathname][equals]=/&limit=1");
  if (!root.docs.length) await createPage({ pathname: "/" });
  const user = await create("users", {
    email: `router-nav-${Date.now()}@example.com`,
    password: "local-router-test-password",
  });
  const login = await request.post(
    `${process.env.CMS_BASE_URL}/api/users/login`,
    { data: { email: user.email, password: "local-router-test-password" } },
  );
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const result = await request.post(
    `${process.env.CMS_BASE_URL}/api/globals/footer`,
    {
      headers: {
        Authorization: `JWT ${token}`,
        Cookie: `payload-token=${token}`,
      },
      data: {
        navItems: links.map(([label, url]) => ({
          link: { type: "custom", label, url },
        })),
      },
    },
  );
  expect(result.ok(), await result.text()).toBeTruthy();
}

const hero = (title: string) => ({
  richText: richTextRoot(heading("h1", text(title))),
});

// Use persisted CMS documents and real application links, so these tests exercise
// the production router, server loaders/actions, and Payload preview transport.
test("renders page and article HTML before JavaScript, including metadata and errors", async ({
  browser,
}) => {
  const pageDoc = await createPage({
    hero: hero("SSR page"),
    meta: { title: "SSR page", description: "SSR description" },
  });
  const post = await createPost({
    title: "SSR article",
    meta: { title: "SSR article" },
  });
  const context = await browser.newContext({
    baseURL: canonicalOrigin,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    for (const [path, title] of [
      [pageDoc.pathname, "SSR page"],
      [`/articles/${post.slug}`, "SSR article"],
    ]) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(page).toHaveTitle(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new URL(path, canonicalOrigin).href,
      );
    }
    expect((await page.goto(`/e2e/missing-${pageDoc.id}`))?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("navigates with data loaders, preserves metadata, and supports browser history", async ({
  page,
  request,
}) => {
  const target = await createPage({
    hero: hero("Navigation target"),
    meta: { title: "Navigation target" },
  });
  const queryPath = `${target.pathname}?q=preserved`;
  const post = await createPost({
    title: "Navigation article",
    meta: { title: "Navigation article" },
  });
  await setLinks(request, [
    ["Visit target", queryPath],
    ["Visit root", "/?q=root"],
  ]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|hydrating|did not match/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto(`/articles/${post.slug}`);
  await page.evaluate(() => {
    (window as Window & { navigationMarker?: boolean }).navigationMarker = true;
  });
  const dataResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `${target.pathname}.data`,
  );
  await page.getByRole("link", { name: "Visit target" }).click();
  expect((await dataResponse).status()).toBe(200);
  await expect(page).toHaveURL(new URL(queryPath, canonicalOrigin).href);
  await expect(page).toHaveTitle("Navigation target");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new URL(queryPath, canonicalOrigin).href,
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { navigationMarker?: boolean }).navigationMarker,
    ),
  ).toBe(true);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Navigation article", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Navigation target", exact: true }),
  ).toBeVisible();
  const rootData = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/_.data",
  );
  await page.getByRole("link", { name: "Visit root", exact: true }).click();
  expect((await rootData).status()).toBe(200);
  await expect(page).toHaveURL(`${canonicalOrigin}/?q=root`);
  expect(errors).toEqual([]);
});

test("handles document and client redirects without leaking data-request URLs", async ({
  page,
  request,
}) => {
  const target = await createPage({ hero: hero("Redirect target") });
  const from = `${target.pathname}-old`;
  await create("redirects", {
    from,
    to: { type: "custom", url: `${target.pathname}?from=cms` },
  });
  for (const [path, expected] of [
    [`${target.pathname}/?q=keep`, `${target.pathname}?q=keep`],
    [from, `${target.pathname}?from=cms`],
  ]) {
    // Use the canonical origin to isolate path/CMS redirects from hostname redirects.
    const response = await request.get(new URL(path, canonicalOrigin).href, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(expected);
  }
  const nonCanonical = new URL(`${target.pathname}?q=host`, canonicalOrigin);
  nonCanonical.hostname = "localhost";
  const hostResponse = await request.get(nonCanonical.href, {
    maxRedirects: 0,
  });
  expect(hostResponse.status()).toBe(301);
  expect(hostResponse.headers().location).toBe(
    new URL(`${target.pathname}?q=host`, canonicalOrigin).href,
  );
  const post = await createPost();
  await setLinks(request, [
    ["Trailing slash", `${target.pathname}/?q=keep`],
    ["CMS redirect", from],
  ]);
  for (const [label, sourcePath, suffix] of [
    ["Trailing slash", `${target.pathname}/`, "?q=keep"],
    ["CMS redirect", from, "?from=cms"],
  ]) {
    await page.goto(`/articles/${post.slug}`);
    const dataPath = sourcePath.endsWith("/")
      ? `${sourcePath}_.data`
      : `${sourcePath}.data`;
    const dataResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === dataPath,
    );
    await page.getByRole("link", { name: label, exact: true }).click();
    expect((await dataResponse).ok()).toBeTruthy();
    await expect(page).toHaveURL(
      new URL(`${target.pathname}${suffix}`, canonicalOrigin).href,
    );
    await expect(
      page.getByRole("heading", { name: "Redirect target" }),
    ).toBeVisible();
  }
});

test("serves resource responses and HEAD without an HTML document", async ({
  request,
}) => {
  const image = await getOrCreate("router-test.svg", "image/svg+xml");
  const articles = await get("pages?where[pathname][equals]=/articles&limit=1");
  if (!articles.docs.length)
    await createPage({
      pathname: "/articles",
      meta: { image: image.id, description: "Articles" },
    });
  for (const [path, contentType, content] of [
    ["/articles/rss.xml", "application/rss+xml", "<rss"],
    ["/sitemap.xml", "application/xml", "<urlset"],
    ["/robots.txt", "text/plain", "Sitemap:"],
    ["/version", "application/json", "version"],
    ["/site.webmanifest", "application/json", "display"],
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(contentType);
    expect(await response.text()).toContain(content);
    expect(await response.text()).not.toContain("<!DOCTYPE html>");
    const head = await request.head(path);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toContain(contentType);
    expect((await head.body()).length).toBe(0);
  }
  const favicon = await request.get("/favicon.ico", { maxRedirects: 0 });
  const meta = await get("globals/meta");
  expect(favicon.status()).toBe(meta.faviconIco ? 302 : 404);
  if (meta.faviconIco)
    expect(favicon.headers().location).toContain(meta.faviconIco.filename);
});

test("authenticates cache-purge actions and invalidates cached page content", async ({
  request,
}) => {
  const doc = await createPage({ hero: hero("Cached before purge") });
  await request.get(doc.pathname);
  await update(`pages/${doc.id}`, { hero: hero("Fresh after purge") });
  expect(await (await request.get(doc.pathname)).text()).toContain(
    "Cached before purge",
  );
  const cacheKey = `pages_${doc.pathname.replaceAll("/", ":")}`;
  const unauthorized = await request.post("/purge-cache", {
    headers: { Authorization: "" },
    data: { cacheKey },
  });
  expect(unauthorized.status()).toBe(401);
  // This endpoint authenticates CMS users, rather than the test API-key collection.
  const user = await create("users", {
    email: `router-${doc.id}@example.com`,
    password: "local-router-test-password",
  });
  const login = await request.post(
    `${process.env.CMS_BASE_URL}/api/users/login`,
    { data: { email: user.email, password: "local-router-test-password" } },
  );
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const response = await request.post("/purge-cache", {
    headers: { Authorization: `JWT ${token}` },
    data: { cacheKey },
  });
  expect(response.status()).toBe(204);
  expect(await (await request.get(doc.pathname)).text()).toContain(
    "Fresh after purge",
  );
});

for (const collection of ["pages", "posts"] as const) {
  test(`preserves ${collection} draft authorization and live-preview updates`, async ({
    page,
    request,
  }) => {
    const published =
      collection === "pages"
        ? await createPage({
            title: "Published preview",
            hero: hero("Published preview"),
          })
        : await createPost({ title: "Published preview" });
    const draft = await update(`${collection}/${published.id}?draft=true`, {
      title: "Draft preview",
      ...(collection === "pages" ? { hero: hero("Draft preview") } : {}),
      _status: "draft",
    });
    expect(draft.id).toBe(published.id);
    const path =
      collection === "pages"
        ? published.pathname
        : `/articles/${published.slug}`;
    expect(await (await request.get(path)).text()).toContain(
      "Published preview",
    );
    expect((await request.get(`${path}?previewKey=wrong`)).status()).toBe(401);
    const previewPath = `${path}?previewKey=${encodeURIComponent(process.env.PREVIEW_KEY ?? "preview-key")}&livePreviewDocument=${collection === "pages" ? "page" : "post"}`;
    expect(await (await request.get(previewPath)).text()).toContain(
      "Draft preview",
    );
    const launcher = await createPost();
    await setLinks(request, [["Open preview", previewPath]]);
    await page.goto(`/articles/${launcher.slug}`);
    await page.getByRole("link", { name: "Open preview", exact: true }).click();
    await expect(page).toHaveURL(new URL(previewPath, canonicalOrigin).href);
    await expect(
      page.getByRole("heading", { name: "Draft preview", exact: true }),
    ).toBeVisible();
    // Send an editor-origin message through the actual Payload subscription and
    // frontend proxy; the update remains unsaved in the CMS.
    const updated = {
      ...draft,
      title: "Unsaved live preview",
      ...(collection === "pages" ? { hero: hero("Unsaved live preview") } : {}),
    };
    await sendPreviewUpdate(page, request, {
      collection,
      data: updated,
      targetOrigin: canonicalOrigin,
    });
    await expect(
      page.getByRole("heading", { name: "Unsaved live preview", exact: true }),
    ).toBeVisible();
    expect(await (await request.get(path)).text()).toContain(
      "Published preview",
    );
  });
}
