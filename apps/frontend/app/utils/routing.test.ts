import { afterEach, expect, test, vi } from "vitest";
import { getCanonicalRequestUrl, getRequestUrl } from "./routing";
import { handleIncomingRequest, handlePathname } from "./routing.server";
import { getEnvironment } from "./environment.server";
import { tryGetPage, tryGetRedirect } from "./cms-data.server";

vi.mock("./cms-data.server", () => ({
  tryGetPage: vi.fn(),
  tryGetRedirect: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

test.each(["/", "/e2e/page", "/articles/post"])(
  "uses the normalized URL for document and data requests to %s",
  async (pathname) => {
    vi.stubEnv("CANONICAL_HOSTNAME", "canonical.localhost");
    const query = "?previewKey=preview-key&livePreviewDocument=post";
    const url = new URL(`http://canonical.localhost${pathname}${query}`);
    const dataPath = pathname === "/" ? "/_.data" : `${pathname}.data`;

    for (const rawPath of [pathname, dataPath]) {
      const request = new Request(
        `http://canonical.localhost${rawPath}${query}&_routes=routes/home`,
        { headers: { "X-Forwarded-Proto": "https" } },
      );
      expect(getRequestUrl(request, url).href).toBe(
        `https://canonical.localhost${pathname}${query}`,
      );
      expect(getCanonicalRequestUrl(request, url).href).toBe(
        `https://canonical.localhost${pathname}${query}`,
      );
      await expect(handleIncomingRequest(request, url)).resolves.toEqual({
        pageUrl: `${pathname}${query}`,
      });
      expect(getEnvironment(request, url).livePreviewDocument).toBe("post");
    }
    expect(url.protocol).toBe("http:");
    expect(url.pathname).toBe(pathname);
  },
);

test.each(["/e2e/page/", "/articles/post/"])(
  "redirects trailing-slash data requests for %s without internal URL details",
  async (pathname) => {
    vi.stubEnv("CANONICAL_HOSTNAME", "canonical.localhost");
    const url = new URL(`http://canonical.localhost${pathname}?q=keep`);
    const request = new Request(
      `http://canonical.localhost${pathname}_.data?q=keep&_routes=route`,
    );
    await expect(handleIncomingRequest(request, url)).rejects.toMatchObject({
      status: 301,
      headers: expect.any(Headers),
    });
    const response = await handleIncomingRequest(request, url).catch(
      (response: Response) => response,
    );
    expect((response as Response).headers.get("Location")).toBe(
      `${pathname.slice(0, -1)}?q=keep`,
    );
    expect(url.pathname).toBe(pathname);
  },
);

test("canonical-host redirects use the normalized URL and forwarded HTTPS", async () => {
  vi.stubEnv("CANONICAL_HOSTNAME", "canonical.localhost");
  const request = new Request("http://other.localhost/path.data?q=keep", {
    headers: { "X-Forwarded-Proto": "https" },
  });
  const response = await handleIncomingRequest(
    request,
    new URL("http://other.localhost/path?q=keep"),
  ).catch((response: Response) => response);
  expect((response as Response).status).toBe(301);
  expect((response as Response).headers.get("Location")).toBe(
    "https://canonical.localhost/path?q=keep",
  );
});

test("resolves CMS redirects and returns 404 for missing content", async () => {
  vi.mocked(tryGetPage).mockResolvedValue(null);
  vi.mocked(tryGetRedirect).mockResolvedValue({
    to: { type: "custom", url: "/destination?from=cms" },
  } as NonNullable<Awaited<ReturnType<typeof tryGetRedirect>>>);
  const response = await handlePathname("/source").catch(
    (response: Response) => response,
  );
  expect((response as Response).status).toBe(301);
  expect((response as Response).headers.get("Location")).toBe(
    "/destination?from=cms",
  );
  vi.mocked(tryGetRedirect).mockResolvedValue(null);
  await expect(handlePathname("/missing")).rejects.toMatchObject({
    status: 404,
  });
});
