/** The public origin is trusted deployment configuration, never a caller header. */
export function webSessionCookieName(publicOrigin: string): string {
  return new URL(publicOrigin).protocol === "https:"
    ? "__Host-oca_session"
    : "oca_session";
}

export function readWebSessionToken(
  request: Request,
  publicOrigin: string,
): string | undefined {
  const name = webSessionCookieName(publicOrigin);
  const matching = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matching.length !== 1) {
    return undefined;
  }
  try {
    const token = decodeURIComponent(matching[0].slice(name.length + 1));
    if (
      !token ||
      token.length > 4096 ||
      token !== token.trim() ||
      /\p{Cc}/u.test(token)
    ) {
      return undefined;
    }
    return token;
  } catch {
    return undefined;
  }
}
