import type { CollectionConfig } from "payload";

import { Archive } from "../../blocks/ArchiveBlock/config";
import { CallToAction } from "../../blocks/CallToAction/config";
import { Content } from "../../blocks/Content/config";
import { FormBlock } from "../../blocks/Form/config";
import { MediaBlock } from "../../blocks/MediaBlock/config";
import { hero } from "@/heros/config";
import { slugField } from "@/fields/slug";
import { populatePublishedAt } from "../../hooks/populatePublishedAt";

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields";
import { PhotosBlock } from "@/blocks/Photos/config";
import { refreshCacheHook } from "@/hooks/refresh-cache-hook";
import { getPageCacheKey } from "@/utilities/frontend-cache";
import { Columns } from "@/blocks/Columns/config";
import { AboutBlock } from "@/blocks/AboutBlock/config";
import { ProjectsBlock } from "@/blocks/Projects/config";

export const Pages: CollectionConfig<"pages"> = {
  slug: "pages",
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
    pathname: true,
  },
  admin: {
    defaultColumns: ["title", "slug", "pathname", "updatedAt"],
    livePreview: {
      url: ({ data }) => {
        const livePreviewUrl = new URL(getPreviewUrl(data));
        livePreviewUrl.searchParams.set("livePreviewDocument", "page");
        return livePreviewUrl.toString();
      },
    },
    preview: (data) => getPreviewUrl(data),
    useAsTitle: "pathname",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      type: "tabs",
      tabs: [
        {
          fields: [hero],
          label: "Hero",
        },
        {
          fields: [
            {
              name: "layout",
              type: "blocks",
              blocks: [
                CallToAction,
                Content,
                MediaBlock,
                Archive,
                FormBlock,
                PhotosBlock,
                Columns,
                AboutBlock,
                ProjectsBlock,
              ],
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: "Content",
        },
        {
          name: "meta",
          label: "SEO",
          fields: [
            OverviewField({
              titlePath: "meta.title",
              descriptionPath: "meta.description",
              imagePath: "meta.image",
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: "media",
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: "meta.title",
              descriptionPath: "meta.description",
            }),
          ],
        },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
      },
    },
    ...slugField(),
    {
      name: "pathname",
      type: "text",
      index: true,
      required: true,
      admin: {
        position: "sidebar",
        placeholder: "e.g. /experiences/lost-city",
        description:
          "The pathname is used to navigate to this page. It must be unique and cannot be changed after the page has been created.",
      },
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, req }) =>
        refreshCacheHook({
          cacheKey: getPageCacheKey(doc),
          pageUrl: doc.pathname,
        })({ req }),
    ],
    beforeChange: [populatePublishedAt],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
};

function getPreviewUrl(data: Record<string, unknown>) {
  return `${process.env.FRONTEND_BASE_URL}${getPagePathname(data.pathname)}?previewKey=${process.env.PREVIEW_KEY}`;
}

function getPagePathname(pathname: unknown) {
  if (typeof pathname !== "string" || !pathname.trim()) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
