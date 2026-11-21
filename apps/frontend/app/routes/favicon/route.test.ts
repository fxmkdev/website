import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getMeta } from "~/utils/cms-data.server";
import { loader } from "./route";

vi.mock("~/utils/cms-data.server", () => ({ getMeta: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("IMAGEKIT_BASE_URL", "https://ik.imagekit.io/demo");
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

function loadFavicon() {
  const url = new URL("https://example.com/favicon.ico");
  return loader({ request: new Request(url), url } as Parameters<
    typeof loader
  >[0]);
}

test("returns 404 when no ICO favicon is configured", async () => {
  vi.mocked(getMeta).mockResolvedValue(
    {} as Awaited<ReturnType<typeof getMeta>>,
  );
  const response = await loadFavicon();
  expect(response.status).toBe(404);
  expect(response.headers.has("Location")).toBe(false);
});

test("redirects to the configured original ICO asset", async () => {
  vi.mocked(getMeta).mockResolvedValue({
    faviconIco: { filename: "favicon.ico" },
  } as Awaited<ReturnType<typeof getMeta>>);
  const response = await loadFavicon();
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe(
    "https://ik.imagekit.io/demo/favicon.ico?tr=f-orig",
  );
});
