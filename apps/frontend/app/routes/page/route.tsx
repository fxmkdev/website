import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { About } from "./about";
import { Archive } from "./archive";
import { Columns } from "./columns";
import { Photos } from "./photos";
import { getCanonicalRequestUrl, getRequestUrl, toUrl } from "~/utils/routing";
import { handleIncomingRequest, handlePathname } from "~/utils/routing.server";
import { Hero } from "./hero";
import { Projects } from "./projects";
import type { Route } from "./+types/route";
import type { SerializeFromLoader } from "~/utils/types";
import { type loader as rootLoader } from "~/root";
import { getPageMetaDescriptors } from "~/utils/page-meta";
import { tryGetPage } from "~/utils/cms-data.server";
import { OptInLivePreview } from "~/components/live-preview";
import { PAGE_DEPTH } from "~/utils/cms-data";

export function meta({ data, matches }: Route.MetaArgs) {
  const { content, canonicalUrl } = data;

  const rootLoaderData = matches.find((m) => m?.id === "root")
    ?.data as SerializeFromLoader<typeof rootLoader>;
  if (!rootLoaderData) throw new Error("No root loader data");

  const parentMeta = matches.flatMap((match) => match?.meta ?? []);
  return [
    ...parentMeta,
    ...getPageMetaDescriptors(
      canonicalUrl,
      content.meta,
      rootLoaderData.meta,
      rootLoaderData.environment,
    ),
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { pageUrl } = await handleIncomingRequest(request);

  const requestUrl = getRequestUrl(request);
  const previewKey = requestUrl.searchParams.get("previewKey");
  if (previewKey && previewKey !== process.env.PREVIEW_KEY) {
    throw new Response(null, { status: 401, statusText: "Unauthorized" });
  }

  const pathname = toUrl(pageUrl).pathname;
  const content = previewKey
    ? await tryGetPage(pathname, true)
    : await handlePathname(pathname);
  if (!content) {
    throw new Response(null, { status: 404, statusText: "Not Found" });
  }

  const dataPath = `pages/${content.id}`;

  return {
    origin: requestUrl.origin,
    canonicalUrl: getCanonicalRequestUrl(request).href,
    pageUrl,
    dataPath,
    content,
  };
}

export default function Route() {
  const { content } = useLoaderData<typeof loader>();
  return (
    <OptInLivePreview document="page" data={content} depth={PAGE_DEPTH}>
      {(content) => (
        <>
          {content.hero && <Hero {...content.hero} />}
          {content.layout?.map((block) => {
            switch (block.blockType) {
              case "photos":
                return <Photos key={block.id} {...block} />;
              case "archive":
                return <Archive key={block.id} {...block} size="full" />;
              case "columns":
                return <Columns key={block.id} {...block} />;
              case "about":
                return <About key={block.id} {...block} />;
              case "projects":
                return <Projects key={block.id} {...block} />;
              default:
                console.warn(`Unknown block type: ${block.blockType}`);
                return null;
            }
          })}
        </>
      )}
    </OptInLivePreview>
  );
}
