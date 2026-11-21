import { redirect } from "react-router";
import { getMeta } from "~/utils/cms-data.server";
import { imagekitUrl } from "~/utils/imagekit";
import type { Route } from "../../+types/root";
import { getEnvironment } from "~/utils/environment.server";
import type { Media } from "@fxmk/payload-types";

export async function loader({ request, url }: Route.LoaderArgs) {
  const meta = await getMeta();
  const environment = getEnvironment(request, url);

  if (!meta.faviconIco) {
    return new Response(null, { status: 404 });
  }

  return redirect(
    `${imagekitUrl(
      environment.imagekitBaseUrl,
      (meta.faviconIco as Media).filename!,
      [{ format: "orig" }],
    )}`,
  );
}
