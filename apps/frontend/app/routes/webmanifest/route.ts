import { getMeta } from "~/utils/cms-data.server";
import { getEnvironment } from "~/utils/environment.server";
import type { Route } from "./+types/route";
import { imagekitUrl } from "~/utils/imagekit";
import type { Media } from "@fxmk/payload-types";

export async function loader({ request, url }: Route.LoaderArgs) {
  const meta = await getMeta();

  const environment = getEnvironment(request, url);
  return Response.json({
    ...(meta.siteName
      ? {
          name: meta.siteName,
          short_name: meta.siteName,
        }
      : {}),
    ...(meta.favicon
      ? {
          icons: [
            {
              src: imagekitUrl(
                environment.imagekitBaseUrl,
                (meta.favicon as Media).filename!,
                [{ format: "png", width: "192", height: "192" }],
              ),
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: imagekitUrl(
                environment.imagekitBaseUrl,
                (meta.favicon as Media).filename!,
                [{ format: "png", width: "512", height: "512" }],
              ),
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        }
      : {}),
    ...(meta.themeColor ? { theme_color: meta.themeColor } : {}),
    ...(meta.backgroundColor ? { background_color: meta.backgroundColor } : {}),
    display: "browser",
  });
}
