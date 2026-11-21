import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { tryGetPost } from "~/utils/cms-data.server";
import { Container } from "~/components/container";
import { formatDate } from "~/utils/format-date";
import { Prose } from "~/components/prose";
import { RichText } from "~/components/rich-text/rich-text";
import type { RichTextObject } from "@fxmk/shared";
import { getCanonicalRequestUrl, getRequestUrl } from "~/utils/routing";
import { handleIncomingRequest } from "~/utils/routing.server";
import { Code } from "./code";
import { ArrowLeftIcon } from "~/components/icons";
import type { Route } from "./+types/route";
import type { SerializeFromLoader } from "~/utils/types";
import { type loader as rootLoader } from "~/root";
import { getPageMetaDescriptors as getPageMetaDescriptors } from "~/utils/page-meta";
import { Link } from "~/components/link";
import { OptInLivePreview } from "~/components/live-preview";
import { POST_DEPTH } from "~/utils/cms-data";
import { Media } from "~/components/media";
import type { Media as MediaType } from "@fxmk/payload-types";
import { PostH2, PostH3, PostH4, PostH5, PostH6 } from "./headings";

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const { content, canonicalUrl } = loaderData;

  const rootLoaderData = matches.find((m) => m?.id === "root")
    ?.loaderData as SerializeFromLoader<typeof rootLoader>;
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

export async function loader({ request, url, params }: LoaderFunctionArgs) {
  await handleIncomingRequest(request, url);
  if (!params.slug) throw new Error("Missing slug");

  const requestUrl = getRequestUrl(request, url);

  const previewKey = requestUrl.searchParams.get("previewKey");
  if (previewKey && previewKey !== process.env.PREVIEW_KEY) {
    throw new Response(null, { status: 401, statusText: "Unauthorized" });
  }

  const content = await tryGetPost(params.slug, !!previewKey);
  if (!content) {
    throw new Response(null, { status: 404, statusText: "Not Found" });
  }
  const dataPath = `pages/${content.id}`;

  return {
    origin: requestUrl.origin,
    canonicalUrl: getCanonicalRequestUrl(request, url).href,
    dataPath,
    content,
  };
}

export default function Route() {
  const { content } = useLoaderData<typeof loader>();
  return (
    <OptInLivePreview document="post" data={content} depth={POST_DEPTH}>
      {(content) => (
        <Container className="mt-16 lg:mt-32">
          <div className="xl:relative">
            <div className="mx-auto max-w-2xl">
              <Link
                to="/articles"
                aria-label="Go back to articles"
                className="group mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ring-1 shadow-zinc-800/5 ring-zinc-900/5 transition lg:absolute lg:-left-5 lg:-mt-2 lg:mb-0 xl:-top-1.5 xl:left-0 xl:mt-0 dark:border dark:border-zinc-700/50 dark:bg-zinc-800 dark:ring-0 dark:ring-white/10 dark:hover:border-zinc-700 dark:hover:ring-white/20"
              >
                <ArrowLeftIcon className="h-4 w-4 stroke-zinc-500 transition group-hover:stroke-zinc-700 dark:stroke-zinc-500 dark:group-hover:stroke-zinc-400" />
              </Link>
              <article>
                <header className="flex flex-col">
                  <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-800 sm:text-5xl dark:text-zinc-100">
                    {content.title}
                  </h1>
                  <time
                    dateTime={content.publishedAt ?? undefined}
                    className="order-first flex items-center text-base text-zinc-400 dark:text-zinc-500"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-zinc-200 dark:bg-zinc-500" />
                    <span className="ml-3">
                      {formatDate(content.publishedAt!)}
                    </span>
                  </time>
                </header>
                <Prose className="mt-8" data-mdx-content>
                  <RichText
                    content={content.content as unknown as RichTextObject}
                    elements={{
                      // reduce by one heading level as the title is already an h1
                      h1: PostH2,
                      h2: PostH3,
                      h3: PostH4,
                      h4: PostH5,
                      h5: PostH6,
                      h6: PostH6,
                    }}
                    blocks={{
                      code: Code,
                      mediaBlock: MediaBlock,
                    }}
                  />
                </Prose>
              </article>
            </div>
          </div>
        </Container>
      )}
    </OptInLivePreview>
  );
}

function MediaBlock({ media }: { media: MediaType | string }) {
  return <Media media={media} preferredImageSize="large" />;
}
