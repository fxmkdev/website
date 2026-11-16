import type { CollectionConfig } from "payload";
import { getPreviewAccess } from "../../utilities/preview-access";

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    defaultColumns: ["name", "email"],
    useAsTitle: "name",
  },
  auth: {
    cookies: getPreviewAccess(process.env.FRONTEND_BASE_URL).cookies,
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
  ],
  timestamps: true,
};
