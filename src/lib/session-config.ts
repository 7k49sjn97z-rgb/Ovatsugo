/** The public .env.example value must never be accepted as a signing key. */
export function isSessionSecretConfigured(
  secret: string | undefined,
): secret is string {
  return Boolean(
    secret &&
      secret.trim().length >= 32 &&
      secret !== "replace-with-at-least-32-random-characters",
  );
}
