import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

// Server-only secret lookup backed by AWS Secrets Manager.
//
// Set SECRETS_MANAGER_PREFIX (e.g. "hartnell-mailer/prod") to read secrets from Secrets Manager.
// Secret names are `${prefix}/${NAME}`, e.g. hartnell-mailer/prod/DUO_CLIENT_SECRET.
// Each secret holds the plain string value (not key/value JSON).
// When the prefix is unset (local dev), it falls back to process.env[NAME].
//
// Values are cached in memory so Secrets Manager is hit once per secret per process.

const globalSecretState = globalThis as typeof globalThis & {
  __hartnellMailerSecrets?: Map<string, Promise<string>>;
  __hartnellMailerSecretsClient?: SecretsManagerClient;
};

const cache = (globalSecretState.__hartnellMailerSecrets ??= new Map());

function secretsClient(): SecretsManagerClient {
  return (globalSecretState.__hartnellMailerSecretsClient ??= new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "us-west-2",
  }));
}

async function fetchSecret(name: string): Promise<string> {
  const prefix = process.env.SECRETS_MANAGER_PREFIX?.trim().replace(/\/+$/, "");

  if (!prefix) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing secret ${name} (set it in .env for local dev).`);
    return value;
  }

  const secretId = `${prefix}/${name}`;
  const response = await secretsClient().send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = response.SecretString?.trim();
  if (!value) throw new Error(`Secret ${secretId} is empty or not a string secret.`);
  return value;
}

export function getSecret(name: string): Promise<string> {
  let pending = cache.get(name);
  if (!pending) {
    pending = fetchSecret(name).catch((error) => {
      cache.delete(name); // don't cache failures
      throw error;
    });
    cache.set(name, pending);
  }
  return pending;
}
