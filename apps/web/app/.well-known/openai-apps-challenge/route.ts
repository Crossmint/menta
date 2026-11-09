export const dynamic = "force-dynamic";

/** OpenAI's domain check for the ChatGPT directory: the exact token from the plugin dashboard, as plain text. */
export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(token, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
