import { startAnalytics } from "./lib/client/analytics";

// Starts PostHog before the app, for visitors who accepted analytics cookies.
startAnalytics();
