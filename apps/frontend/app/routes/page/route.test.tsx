import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { tryGetPage, tryGetRedirect } from "~/utils/cms-data.server";
import { loader } from "./route";

vi.mock("~/utils/cms-data.server", () => ({
  tryGetPage: vi.fn(),
  tryGetRedirect: vi.fn(),
}));
vi.mock("./hero", () => ({ Hero: vi.fn() }));
vi.mock("./about", () => ({ About: vi.fn() }));
vi.mock("./archive", () => ({ Archive: vi.fn() }));
vi.mock("./columns", () => ({ Columns: vi.fn() }));
vi.mock("./photos", () => ({ Photos: vi.fn() }));
vi.mock("./projects", () => ({ Projects: vi.fn() }));

function loadPage(path: string) {
  return loader({
    request: new Request(`https://example.com${path}`),
    url: new URL(`https://example.com${path}`),
  } as Parameters<typeof loader>[0]);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CANONICAL_HOSTNAME", "example.com");
  vi.stubEnv("PREVIEW_KEY", "secret+&key");
});

afterEach(() => vi.unstubAllEnvs());

test("rejects an invalid key before fetching page data", async () => {
  await expect(loadPage("/?previewKey=wrong")).rejects.toMatchObject({
    status: 401,
  });
  expect(tryGetPage).not.toHaveBeenCalled();
  expect(tryGetRedirect).not.toHaveBeenCalled();
});

test("loads draft content by pathname with a valid encoded key", async () => {
  const draft = { id: "draft", _status: "draft" } as NonNullable<
    Awaited<ReturnType<typeof tryGetPage>>
  >;
  vi.mocked(tryGetPage).mockResolvedValue(draft);

  const result = await loadPage(
    "/experiences/lost-city?previewKey=secret%2B%26key&livePreviewDocument=page",
  );

  expect(result.content).toEqual(draft);
  expect(tryGetPage).toHaveBeenCalledWith("/experiences/lost-city", true);
});

test("returns 404 for a missing draft instead of falling back to redirects", async () => {
  vi.mocked(tryGetPage).mockResolvedValue(null);

  await expect(
    loadPage("/missing?previewKey=secret%2B%26key"),
  ).rejects.toMatchObject({ status: 404 });
  expect(tryGetRedirect).not.toHaveBeenCalled();
});

test.each(["/old", "/old?previewKey=", "/old?livePreviewDocument=page"])(
  "preserves published redirect lookup without a valid preview key: %s",
  async (path) => {
    vi.mocked(tryGetPage).mockResolvedValue(null);
    vi.mocked(tryGetRedirect).mockResolvedValue({
      to: { type: "custom", url: "/new" },
    } as NonNullable<Awaited<ReturnType<typeof tryGetRedirect>>>);

    await expect(loadPage(path)).rejects.toMatchObject({ status: 301 });
    expect(tryGetPage).toHaveBeenCalledWith("/old");
    expect(tryGetRedirect).toHaveBeenCalledWith("/old");
  },
);
