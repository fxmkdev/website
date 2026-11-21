import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getPreviewAccess } from "../../../apps/cms/src/utilities/preview-access";
import { create, createPage } from "../common/cms";

const frontendUrl = new URL(process.env.FRONTEND_BASE_URL!);
frontendUrl.hostname = process.env.CANONICAL_HOSTNAME ?? "canonical.localhost";
const frontendOrigin = frontendUrl.origin;
const cmsOrigin = new URL(process.env.CMS_BASE_URL!).origin;
const untrustedOrigin = "https://untrusted.example";

test("preview policy normalizes origins and selects appropriate cookies", () => {
  expect(getPreviewAccess("https://frontend.example/path/")).toEqual({
    origins: ["https://frontend.example"],
    cookies: { sameSite: "None", secure: true },
  });
  expect(getPreviewAccess("http://localhost:3000/")).toEqual({
    origins: ["http://localhost:3000"],
    cookies: { sameSite: "Lax", secure: false },
  });
  expect(getPreviewAccess()).toEqual({
    origins: [],
    cookies: { sameSite: "Lax", secure: false },
  });
  expect(() => getPreviewAccess("file:///tmp/preview")).toThrow();
  expect(() => getPreviewAccess("invalid-url")).toThrow();
});

test("CMS preflight allows the configured frontend and rejects other origins", async () => {
  for (const origin of [frontendOrigin, untrustedOrigin]) {
    const response = await fetch(
      new URL("/api/pages", process.env.CMS_BASE_URL),
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "content-type,x-payload-http-method-override",
        },
      },
    );
    expect(response.ok).toBe(true);
    if (origin === frontendOrigin) {
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
      const headers = response.headers
        .get("Access-Control-Allow-Headers")
        ?.toLowerCase();
      expect(headers).toContain("content-type");
      expect(headers).toContain("x-payload-http-method-override");
    } else {
      expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
      expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(
        false,
      );
    }
  }
});

test("CMS cookie authentication permits preview population and admin requests only from trusted origins", async () => {
  const email = `preview-${randomUUID()}@example.com`;
  const password = randomUUID();
  const user = await create("users", { email, password });
  try {
    const login = await fetch(
      new URL("/api/users/login", process.env.CMS_BASE_URL),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: cmsOrigin },
        body: JSON.stringify({ email, password }),
      },
    );
    expect(login.ok).toBe(true);
    const setCookie = login.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("payload-token="));
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/;\s*Secure/i);
    const cookie = setCookie!.split(";")[0];

    for (const origin of [cmsOrigin, frontendOrigin, untrustedOrigin]) {
      const response = await fetch(
        new URL("/api/users/me", process.env.CMS_BASE_URL),
        {
          headers: { Origin: origin, Cookie: cookie },
        },
      );
      const data = await response.json();
      if (origin === untrustedOrigin) {
        expect(data.user).toBeNull();
      } else {
        expect(data.user.id).toBe(user.id);
      }
    }

    const page = await createPage();
    const population = await fetch(
      new URL(`/api/pages/${page.id}`, process.env.CMS_BASE_URL),
      {
        method: "POST",
        headers: {
          Origin: frontendOrigin,
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Payload-HTTP-Method-Override": "GET",
        },
        body: JSON.stringify({
          data: { ...page, title: "Unsaved preview title" },
          depth: 1,
          flattenLocales: false,
        }),
      },
    );
    expect(population.ok).toBe(true);
    expect(population.headers.get("Access-Control-Allow-Origin")).toBe(
      frontendOrigin,
    );
    expect((await population.json()).title).toBe("Unsaved preview title");
  } finally {
    const cleanup = await fetch(
      new URL(`/api/users/${user.id}`, process.env.CMS_BASE_URL),
      {
        method: "DELETE",
        headers: {
          Authorization: `api-keys API-Key ${process.env.CMS_API_KEY}`,
        },
      },
    );
    expect(cleanup.ok).toBe(true);
  }
});
