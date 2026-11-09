import { z } from "zod";

const name = "oca_push_device";
/** A device hint, never authorization: every lookup still uses the verified Stytch user. */
export function notificationDevice(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  const id = z.uuid().safeParse(value);
  return id.success ? id.data : null;
}
export function notificationCookie(
  response: Response,
  request: Request,
  id: string | null,
) {
  response.headers.append(
    "Set-Cookie",
    `${name}=${id ?? ""}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${id ? 365 * 24 * 60 * 60 : 0}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  );
  return response;
}
