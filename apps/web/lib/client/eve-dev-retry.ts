"use client";

/**
 * Local `eve dev` occasionally answers with an instant 408 before the request
 * reaches the agent (its worker proxy, not our code). Such a request was never
 * handled, so retrying it is safe. Production does not use this path.
 */
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production" &&
  !(window as { __eveRetry?: boolean }).__eveRetry
) {
  (window as { __eveRetry?: boolean }).__eveRetry = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.includes("/eve/v1/")) {
      return original(input, init);
    }
    const request = new Request(input, init);
    for (let attempt = 0; ; attempt++) {
      const response = await original(request.clone());
      if (response.status !== 408 || attempt >= 30) {
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };
}

export {};
