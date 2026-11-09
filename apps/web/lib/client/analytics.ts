import type { PostHog } from "posthog-js";

// Product analytics, only for visitors who accept the cookie banner: until
// then PostHog isn't loaded, so nothing is sent to it or stored for it.
// Pageviews and clicks, with clicked text masked and session replay off,
// since pages show addresses, cards and store sign-ins. Builds without a
// key don't ship the SDK or show the banner.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const CHOICE = "menta-analytics";
const CHANGE = "menta:cookie-choice";

type Choice = "granted" | "denied";

let loading: Promise<PostHog | undefined> | undefined;
// The answer when it couldn't be saved (storage blocked or full), so this
// visit still follows it.
let unsaved: Choice | undefined;

/** Loads PostHog and opts in; only called once the visitor accepted. */
function load(key: string): Promise<PostHog | undefined> {
  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        // The newest defaults: also skips localhost and URL hashes.
        defaults: "2026-08-30",
        person_profiles: "identified_only",
        disable_session_recording: true,
        mask_all_text: true,
        // Clicks only, as the privacy policy says: no change or submit events.
        autocapture: { dom_event_allowlist: ["click"] },
        // No feature flags or remote config: start-up and a decline make no
        // /flags or remote-config request, and the dashboard's project
        // settings (autocapture, heatmaps, surveys…) don't apply. What's
        // captured is set here only, to match the privacy policy.
        advanced_disable_flags: true,
        // Off unless PostHog's own consent flag says granted, so deleting it
        // (declining here or in another tab) stops capturing in every tab.
        opt_out_capturing_by_default: true,
        // Declining later deletes PostHog's cookie and stored IDs.
        opt_out_persistence_by_default: true,
      });
      // Declined in another tab: stop here too. Reads the choice now, not
      // the event's value, since a tab resuming from the background may get
      // a decline the visitor has since undone.
      window.addEventListener("storage", (event) => {
        if (event.key === CHOICE && cookieChoice() === "denied") {
          stop(posthog);
        }
      });
      return posthog;
    })
    .catch(() => {
      // Not loaded (offline, blocked): the next accept or visit tries again.
      loading = undefined;
      return undefined;
    });
  return loading.then((posthog) => {
    // Declined in another tab while this one was loading: opting in would
    // write PostHog's consent flag back and turn capturing on in every tab.
    if (cookieChoice() !== "denied") {
      posthog?.opt_in_capturing({ captureEventName: false });
    }
    return posthog;
  });
}

/** The visitor's answer to the cookie banner, if they gave one in this browser. */
export function cookieChoice(): Choice | null {
  if (unsaved) {
    return unsaved;
  }
  try {
    const value = localStorage.getItem(CHOICE);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/** Whether to ask: PostHog is configured and the visitor hasn't answered. */
export function needsCookieChoice() {
  return Boolean(KEY) && cookieChoice() === null;
}

/** Starts PostHog if the visitor accepted analytics cookies. */
export function startAnalytics() {
  if (KEY && cookieChoice() === "granted") {
    void load(KEY);
  }
}

/** Records the visitor's answer (the banner or the privacy policy's switch) and starts or stops PostHog to match. */
export function chooseCookies(accept: boolean) {
  const choice = accept ? "granted" : "denied";
  try {
    localStorage.setItem(CHOICE, choice);
    unsaved = undefined;
  } catch {
    // Unsaved, the banner asks again next visit; this visit still follows the answer.
    unsaved = choice;
  }
  window.dispatchEvent(new Event(CHANGE));
  if (!KEY) {
    return;
  }
  if (accept) {
    void load(KEY);
  } else if (loading) {
    // Accepted before: stop it.
    void loading.then((posthog) => (posthog ? stop(posthog) : forgetPostHog()));
  } else {
    forgetPostHog();
  }
}

/**
 * Stops capturing, drops the IDs PostHog holds in memory (accepting again
 * would save them back), then deletes what it stored.
 */
function stop(posthog: PostHog) {
  posthog.opt_out_capturing();
  posthog.reset(true);
  forgetPostHog();
}

/** Deletes PostHog's cookies (on this host and the parent domains it may use) and stored IDs. */
function forgetPostHog() {
  try {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (/^(__)?ph_/.test(key)) {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // No storage, nothing stored.
  }
  const labels = location.hostname.split(".");
  const domains = [
    "",
    ...labels
      .slice(1, -1)
      .map((_, i) => `; domain=.${labels.slice(i + 1).join(".")}`),
    `; domain=.${location.hostname}`,
  ];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name?.startsWith("ph_")) {
      for (const domain of domains) {
        // biome-ignore lint/suspicious/noDocumentCookie: deleting PostHog's cookies; Cookie Store isn't in every browser
        document.cookie = `${name}=; max-age=0; path=/${domain}`;
      }
    }
  }
}

/** Calls back whenever the cookie choice changes: on this page or in another tab. */
export function onCookieChoiceChanged(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHOICE || event.key === null) {
      callback();
    }
  };
  window.addEventListener(CHANGE, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE, callback);
    window.removeEventListener("storage", onStorage);
  };
}
