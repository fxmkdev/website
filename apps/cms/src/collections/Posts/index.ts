import type { CollectionConfig } from "payload";

import {
  MetaDescriptionField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields";
import { slugField } from "@/fields/slug";
import { seoImageField } from "@/fields/seo-image";
import { refreshCacheHook } from "@/hooks/refresh-cache-hook";
import { getCollectionItemCacheKey } from "@/utilities/frontend-cache";
import { contentFields } from "./content";

export const Posts: CollectionConfig<"posts"> = {
  slug: "posts",
  // This config controls what's populated by default when a post is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'posts'>
  defaultPopulate: {
    title: true,
    slug: true,
    categories: true,
    meta: {
      image: true,
      description: true,
    },
  },
  admin: {
    defaultColumns: ["title", "slug", "updatedAt"],
    livePreview: {
      url: ({ data }) => {
        const livePreviewUrl = new URL(getPreviewUrl(data));
        livePreviewUrl.searchParams.set("livePreviewDocument", "post");
        return livePreviewUrl.toString();
      },
    },
    preview: (data) => getPreviewUrl(data),
    useAsTitle: "title",
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
          fields: [
            // {
            //   name: "heroImage",
            //   type: "upload",
            //   relationTo: "media",
            // },
            ...contentFields(),
          ],
          label: "Content",
        },
        {
          fields: [
            {
              name: "relatedPosts",
              type: "relationship",
              admin: {
                position: "sidebar",
              },
              filterOptions: ({ id }) => {
                return {
                  id: {
                    not_in: [id],
                  },
                };
              },
              hasMany: true,
              relationTo: "posts",
            },
            {
              name: "categories",
              type: "relationship",
              admin: {
                position: "sidebar",
              },
              hasMany: true,
              relationTo: "categories",
            },
          ],
          label: "Meta",
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
            seoImageField(),

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
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === "published" && !value) {
              return new Date();
            }
            return value;
          },
        ],
      },
    },
    ...slugField(),
  ],
  hooks: {
    afterChange: [
      ({ doc, req }) =>
        refreshCacheHook({
          cacheKey: getCollectionItemCacheKey("posts", doc.slug),
          pageUrl: getPagePathname(doc.slug),
        })({ req }),
    ],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
};

function getPreviewUrl(data: Record<string, unknown>) {
  return `${process.env.FRONTEND_BASE_URL}${getPagePathname(data.slug as string)}?previewKey=${process.env.PREVIEW_KEY}`;
}

function getPagePathname(slug: string) {
  return `/articles/${slug}`;
}
