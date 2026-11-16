// storage-adapter-import-placeholder
import { mongooseAdapter } from "@payloadcms/db-mongodb";

import sharp from "sharp"; // sharp-import
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";

import { Categories } from "./collections/Categories";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Posts } from "./collections/Posts";
import { Users } from "./collections/Users";
import { Footer } from "./Footer/config";
import { Header } from "./Header/config";
import { plugins } from "./plugins";
import { defaultLexical } from "@/fields/defaultLexical";
import { Config } from "./payload-types";
import { SocialLinks } from "./collections/SocialLinks";
import { Meta } from "./meta/config";
import { ApiKeys } from "./collections/api-keys/config";
import { getPreviewAccess } from "./utilities/preview-access";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const previewAccess = getPreviewAccess(process.env.FRONTEND_BASE_URL);

declare module "payload" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface GeneratedTypes extends Config {}
}

export default buildConfig({
  cors: [...previewAccess.origins],
  csrf: [...previewAccess.origins],
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    components: {
      beforeNavLinks: ["@/common/version-info#VersionInfo"],
    },
    livePreview: {
      breakpoints: [
        {
          label: "Mobile",
          name: "mobile",
          width: 375,
          height: 667,
        },
        {
          label: "Tablet",
          name: "tablet",
          width: 768,
          height: 1024,
        },
        {
          label: "Desktop",
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
  }),
  collections: [Pages, Posts, Categories, SocialLinks, Media, Users, ApiKeys],
  globals: [Header, Footer, Meta],
  plugins,
  secret: process.env.PAYLOAD_SECRET!,
  serverURL: process.env.SERVER_URL
    ? new URL(process.env.SERVER_URL).origin
    : undefined,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
    declare: false,
  },
  async onInit(payload) {
    if (!!process.env.E2E_TESTS_API_KEY) {
      const e2eTestApiKeys = await payload.find({
        collection: "api-keys",
        where: { name: { equals: "e2e-tests" } },
        pagination: false,
      });

      if (e2eTestApiKeys.totalDocs === 0) {
        await payload.create({
          collection: "api-keys",
          data: {
            enableAPIKey: true,
            apiKey: process.env.E2E_TESTS_API_KEY,
            name: "e2e-tests",
          },
        });
      }
    }
  },
});
