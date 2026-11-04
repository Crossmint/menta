import { webSessionCookieName } from "@oca/agent/auth";

/** Both verified login methods publish the same server-only session cookies. */
export function writeWebSessionCookies(
  response: Response,
  options: {
    origin: string;
    sessionToken: string;
    sessionDurationMinutes: number;
  },
): Response {
  const secure = new URL(options.origin).protocol === "https:";
  response.headers.append(
    "Set-Cookie",
    `${webSessionCookieName(options.origin)}=${encodeURIComponent(options.sessionToken)}; Path=/; Max-Age=${options.sessionDurationMinutes * 60}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  response.headers.append(
    "Set-Cookie",
    `${secure ? "__Secure-" : ""}oca_otp_method=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
  );
  return response;
}

/** Expires the session cookie: Stytch no longer has the session it names. */
export function clearWebSessionCookie(response: Response, origin: string) {
  const secure = new URL(origin).protocol === "https:";
  response.headers.append(
    "Set-Cookie",
    `${webSessionCookieName(origin)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return response;
}
