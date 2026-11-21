import type { ActionFunctionArgs } from "react-router";
import { PAGE_DEPTH, POST_DEPTH } from "~/utils/cms-data";

const headers = { "Cache-Control": "no-store" };

export function loader() {
  return new Response(null, {
    status: 405,
    headers: { ...headers, Allow: "POST" },
  });
}

export async function action({ request, url }: ActionFunctionArgs) {
  if (request.method !== "POST") return loader();

  const previewKey = url.searchParams.get("previewKey");
  if (!process.env.PREVIEW_KEY || previewKey !== process.env.PREVIEW_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const body: unknown = await request.json().catch(() => null);
  const target =
    isRecord(body) && typeof body.endpoint === "string"
      ? /^(pages|posts)\/([a-fA-F\d]{24})$/.exec(body.endpoint)
      : null;
  if (
    !target ||
    !isRecord(body) ||
    !isRecord(body.data) ||
    !isRecord(body.data.data)
  ) {
    return Response.json(
      { error: "Invalid preview request" },
      { status: 400, headers },
    );
  }

  if (!process.env.PAYLOAD_CMS_BASE_URL || !process.env.PAYLOAD_CMS_API_KEY) {
    return Response.json(
      { error: "Preview is not configured" },
      { status: 503, headers },
    );
  }

  const [, collection, id] = target;
  try {
    const response = await fetch(
      new URL(`/api/${collection}/${id}`, process.env.PAYLOAD_CMS_BASE_URL),
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `api-keys API-Key ${process.env.PAYLOAD_CMS_API_KEY}`,
          "Content-Type": "application/json",
          "X-Payload-HTTP-Method-Override": "GET",
        },
        body: JSON.stringify({
          data: { ...body.data.data, id },
          depth: collection === "pages" ? PAGE_DEPTH : POST_DEPTH,
          flattenLocales: false,
        }),
      },
    );
    if (!response.ok) throw new Error("CMS preview request failed");
    return Response.json(await response.json(), { headers });
  } catch {
    return Response.json(
      { error: "Preview update failed" },
      { status: 502, headers },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
