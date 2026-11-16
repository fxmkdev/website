export function getPreviewAccess(frontendBaseUrl?: string) {
  const frontendUrl = frontendBaseUrl ? new URL(frontendBaseUrl) : undefined;
  if (
    frontendUrl &&
    frontendUrl.protocol !== "http:" &&
    frontendUrl.protocol !== "https:"
  ) {
    throw new Error("FRONTEND_BASE_URL must use HTTP or HTTPS");
  }

  const secure = frontendUrl?.protocol === "https:";
  return {
    origins: frontendUrl ? [frontendUrl.origin] : [],
    cookies: {
      sameSite: secure ? ("None" as const) : ("Lax" as const),
      secure,
    },
  };
}
