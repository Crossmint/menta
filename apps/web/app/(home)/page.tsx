import { Landing } from "./landing";
import { landingMetadata } from "./meta";

/** The homepage in English. Other languages are at /es, /ja and so on ([locale]). */
export function generateMetadata() {
  return landingMetadata("en");
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const { country } = await searchParams;
  return (
    <Landing
      locale="en"
      country={typeof country === "string" ? country : null}
    />
  );
}
