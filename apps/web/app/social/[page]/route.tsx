import { SOCIAL_PAGES } from "../pages";

// Drawn once at build, like the opengraph-image files they replaced; any
// other name is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SOCIAL_PAGES).map((page) => ({ page }));
}

/** A signed-in page's link image (see ../pages.tsx), public so crawlers get it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const entry = Object.hasOwn(SOCIAL_PAGES, page)
    ? SOCIAL_PAGES[page as keyof typeof SOCIAL_PAGES]
    : null;
  if (!entry) {
    return new Response("Not found", { status: 404 });
  }
  return entry.image();
}
