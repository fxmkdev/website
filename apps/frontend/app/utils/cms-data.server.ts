import fs from "fs/promises";
import {
  type Footer,
  type Header,
  type Meta,
  type Page,
  type Post,
  type Redirect,
} from "@fxmk/payload-types";
import path from "path";
import { PAGE_DEPTH, POST_DEPTH } from "./cms-data";

const CACHE_DIR = "./.cms-cache";
const CACHE_EXPIRY_IN_MS = 1000 * 60; // 1 min

async function loadAndCacheData<TData, TResult>(
  url: string,
  cacheFilePath: string,
  depth: number,
  queryParams: Record<string, string>,
  getResultFn: (data: TData | null) => TResult | null,
) {
  const result = getResultFn(await loadData(url, depth, queryParams));

  if (result) {
    await cacheData(cacheFilePath, result);
  }

  return result;
}

async function cacheData(cacheFilePath: string, data: object) {
  console.log(`Caching data to ${cacheFilePath}`);
  await ensureDirectoryExists(path.dirname(cacheFilePath));
  await fs.writeFile(cacheFilePath, JSON.stringify(data));
}

function getCacheFolder(cacheKey: string) {
  return `${CACHE_DIR}/${cacheKey}`;
}

function getCacheFilePath(cacheKey: string) {
  return `${getCacheFolder(cacheKey)}/data.json`;
}

async function getData<TData, TResult>(
  pathname: string,
  cacheKey: string,
  depth = 1,
  queryParams = {},
  getResultFn: (data: TData | null) => TResult | null = (data: TData | null) =>
    data as TResult,
  isPreviewMode: boolean = false,
) {
  if (isPreviewMode) {
    // skip the cache for preview mode
    return getResultFn(await loadData(pathname, depth, queryParams, true));
  }

  const cacheFilePath = getCacheFilePath(cacheKey);
  try {
    const cache = await fs.readFile(cacheFilePath, "utf8");

    // refresh cache in the background _after_ returning the cached data (stale-while-revalidate)
    queueMicrotask(async () => {
      try {
        const cacheLastModified = (await fs.stat(cacheFilePath)).mtime;

        const cacheExpired =
          cacheLastModified.getTime() + CACHE_EXPIRY_IN_MS < Date.now();
        if (!cacheExpired) {
          console.log(`Cache not expired for ${cacheKey}`);
          return;
        }

        console.log(`Cache expired for ${cacheKey}`);
        await loadAndCacheData(
          pathname,
          cacheFilePath,
          depth,
          queryParams,
          getResultFn,
        );
      } catch (e) {
        // As this runs in the background, just log the error
        console.error(
          `Failed to refresh cache in microtask for ${cacheKey}: ${e}`,
        );
      }
    });

    console.log(`Cache hit for ${pathname}`);
    return JSON.parse(cache) as TResult;
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;

    console.log(`Cache miss for ${pathname}`);
    return await loadAndCacheData(
      pathname,
      cacheFilePath,
      depth,
      queryParams,
      getResultFn,
    );
  }
}

export async function loadData(
  pathname: string,
  depth: number,
  queryParams: Record<string, string>,
  isPreviewMode: boolean = false,
) {
  if (!process.env.PAYLOAD_CMS_BASE_URL) {
    throw new Error("PAYLOAD_CMS_BASE_URL is not set");
  }
  if (!process.env.PAYLOAD_CMS_API_KEY) {
    throw new Error("PAYLOAD_CMS_API_KEY is not set");
  }
  const url = new URL(`/api/${pathname}`, process.env.PAYLOAD_CMS_BASE_URL);
  url.searchParams.set("depth", depth.toString());
  url.searchParams.set("draft", isPreviewMode ? "true" : "false");
  url.searchParams.set("pagination", "false");
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  console.log(`Loading data from CMS for ${url.toString()}`);
  const response = await fetch(url, {
    headers: {
      Authorization: `api-keys API-Key ${process.env.PAYLOAD_CMS_API_KEY}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;

    throw new Error(`Failed to load data from CMS: ${response.status}`);
  }

  return await response.json();
}

export async function getHeader() {
  const header = (await getData(
    "globals/header",
    "globals_header",
    1,
  )) as Header | null;
  if (!header) throw new Error("Could not load Header global");

  return header;
}

export async function getMeta() {
  const meta = (await getData(
    "globals/meta",
    "globals_meta",
    1,
  )) as Meta | null;
  if (!meta) throw new Error("Could not load Meta global");

  return meta;
}

export async function getFooter() {
  const footer = (await getData(
    "globals/footer",
    "globals_footer",
    1,
  )) as Footer | null;
  if (!footer) throw new Error("Could not load Header global");

  return footer;
}

export async function tryGetPage(
  pathname: string,
  isPreviewMode: boolean = false,
) {
  const queryParams: Record<string, unknown> = {
    "where[pathname][equals]": pathname,
    limit: 1,
  };

  if (!isPreviewMode) {
    queryParams["where[_status][equals]"] = "published";
  }

  return await getData<{ docs: Page[] }, Page>(
    `pages`,
    `pages_${pathname.replaceAll("/", ":")}`,
    PAGE_DEPTH,
    queryParams,
    (data) => (data && data.docs.length > 0 ? data.docs[0] : null),
    isPreviewMode,
  );
}

export async function getPages() {
  return (await loadData(`pages`, 0, { "where[_status][equals]": "published" }))
    .docs as Page[];
}

export async function getPosts(depth = 0) {
  return (
    await loadData(`posts`, depth, { "where[_status][equals]": "published" })
  ).docs as Post[];
}

export async function tryGetRedirect(pathname: string) {
  return await getData<{ docs: Redirect[] }, Redirect>(
    `redirects`,
    `redirects_${pathname.replaceAll("/", ":")}`,
    1,
    {
      "where[from][equals]": pathname,
      limit: 1,
    },
    (data) => (data && data.docs.length > 0 ? data.docs[0] : null),
  );
}

export async function tryGetPost(slug: string, isPreviewMode: boolean = false) {
  const queryParams: Record<string, unknown> = {
    "where[slug][equals]": slug,
    limit: 1,
  };

  if (!isPreviewMode) {
    queryParams["where[_status][equals]"] = "published";
  }

  return await getData<{ docs: Post[] }, Post>(
    `posts`,
    `posts_${slug}`,
    POST_DEPTH,
    queryParams,
    (data) => (data && data.docs.length > 0 ? data.docs[0] : null),
    isPreviewMode,
  );
}

export async function purgeCacheFor(cacheKey: string) {
  const cacheFolderPath = getCacheFolder(cacheKey);
  await deleteFolderIfExists(cacheFolderPath);
}

async function deleteFolderIfExists(folderPath: string) {
  await fs.rm(folderPath, { recursive: true, force: true });
}

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== "EEXIST") throw e;
  }
}
