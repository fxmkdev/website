import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import appStylesheet from "./app.css?url";
import prismStylesheet from "./prism.css?url";
import { LayoutContainer } from "./layout/layout-container";
import { getFooter, getHeader, getMeta } from "./utils/cms-data.server";
import { EnvironmentContext } from "./utils/environment";
import { AnalyticsScript } from "./components/analytics-script";
import { getEnvironment } from "./utils/environment.server";
import { Toaster } from "./layout/toaster";
import { imagekitUrl } from "./utils/imagekit";
import type { Media } from "@fxmk/payload-types";
import { ThemeInitScript } from "./layout/theme";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "stylesheet", href: appStylesheet },
  { rel: "stylesheet", href: prismStylesheet },
  {
    rel: "manifest",
    href: `/site.webmanifest`,
  },
];

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [];
  }

  return [
    ...(loaderData.meta.siteName
      ? [
          {
            name: "apple-mobile-web-app-title",
            content: loaderData.meta.siteName,
          },
        ]
      : []),
    {
      name: "theme-color",
      content: loaderData.meta.themeColorDark,
      media: "(prefers-color-scheme: dark)",
    },
    ...(loaderData.meta.favicon
      ? [
          {
            tagName: "link",
            rel: "icon",
            type: "image/png",
            sizes: "96x96",
            href: imagekitUrl(
              loaderData.environment.imagekitBaseUrl,
              (loaderData.meta.favicon as Media).filename!,
              [{ format: "png", width: "96", height: "96" }],
            ),
          },
          {
            tagName: "link",
            rel: "apple-touch-icon",
            sizes: "180x180",
            href: imagekitUrl(
              loaderData.environment.imagekitBaseUrl,
              (loaderData.meta.favicon as Media).filename!,
              [{ format: "png", width: "180", height: "180" }],
            ),
          },
        ]
      : []),
    ...(loaderData.meta.faviconIco
      ? [
          {
            tagName: "link",
            rel: "shortcut icon",
            href: imagekitUrl(
              loaderData.environment.imagekitBaseUrl,
              (loaderData.meta.faviconIco as Media).filename!,
              [{ format: "orig" }],
            ),
          },
        ]
      : []),
    ...(loaderData.meta.faviconSvg
      ? [
          {
            tagName: "link",
            rel: "icon",
            type: "image/svg+xml",
            href: imagekitUrl(
              loaderData.environment.imagekitBaseUrl,
              (loaderData.meta.faviconSvg as Media).filename!,
              [{ format: "orig" }],
            ),
          },
        ]
      : []),
  ];
};

export async function loader({ request, url }: Route.LoaderArgs) {
  const [header, footer, meta] = await Promise.all([
    getHeader(),
    getFooter(),
    getMeta(),
  ]);

  return {
    header,
    footer,
    meta,
    environment: getEnvironment(request, url),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { header, footer, environment, meta } = useLoaderData<typeof loader>();
  return (
    <html
      lang={meta.locale ?? undefined}
      className="h-full scroll-pt-6 antialiased"
      suppressHydrationWarning={true} // Prevent hydration warning due to theme class added by client-side code
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <AnalyticsScript analyticsDomain={environment.analyticsDomain} />
        <ThemeInitScript />
      </head>
      <body className="flex h-full bg-zinc-50 dark:bg-black">
        <EnvironmentContext.Provider value={environment}>
          <div className="flex w-full">
            <LayoutContainer header={header} footer={footer}>
              {children}
            </LayoutContainer>
          </div>
          <Toaster />
        </EnvironmentContext.Provider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
