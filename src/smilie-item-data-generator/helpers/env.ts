const sanitizeEnvValue = (value: string): string =>
  value.trim().replace(/^[`'"]/, "").replace(/[;`'"]+$/g, "");

export function getRequiredEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  const sanitized = sanitizeEnvValue(raw);
  if (!sanitized) {
    throw new Error(`Environment variable ${name} is empty after sanitizing.`);
  }
  return sanitized;
}

export function getOptionalEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  const sanitized = sanitizeEnvValue(raw);
  return sanitized || undefined;
}
