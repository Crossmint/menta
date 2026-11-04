export function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

/** Exact public origin, e.g. http://localhost:3000 or https://menta.crossmint.com. */
export function webOrigin() {
  return new URL(requireEnv("OCA_WEB_ORIGIN")).origin;
}
