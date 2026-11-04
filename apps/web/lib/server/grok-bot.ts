/** Why a test didn't start a Grok Bot routine run, in the account page's words. */
export function testProblem(reason: string) {
  switch (reason) {
    case "http_4xx":
      return "Grok Bot refused it. Check the key, and that the routine isn't paused.";
    case "key_unreadable":
      return "The saved key can't be read any more. Paste it again.";
    case "not_configured":
      return "No Grok Bot routine is saved.";
    case "timeout":
    case "http_5xx":
    case "connection_refused":
    case "tls_error":
      return "Grok Bot didn't answer. Try again in a moment.";
    default:
      return "The test didn't go through. Try again.";
  }
}

/** A test's outcome for the account page: never the key or the URL. */
export function testResult(
  result: { ok: true } | { ok: false; reason: string },
) {
  return result.ok
    ? { ok: true as const }
    : { ok: false as const, error: testProblem(result.reason) };
}
