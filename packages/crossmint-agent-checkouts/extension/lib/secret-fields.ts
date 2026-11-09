/** Secret requests stay private even when the store uses an ordinary input. */
export function asksForSecret(text: string) {
  return /pass ?(word|code|phrase)|\bpin\b|\bcvc\b|\bcvv\b|\bcsc\b|security[- ]code|card[- ]number|verification[- ]code|\b(?:one[- ]time|recovery|backup|auth(?:entication|orization)?|access|secret|private|api)[- ](?:code|token|key|phrase|credential)s?\b|seed[- ]phrase|\botp\b|\b2fa\b|\bssn\b|social security/i.test(
    text,
  );
}
