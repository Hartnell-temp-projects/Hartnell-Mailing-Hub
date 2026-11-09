import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

// Server-only secret lookup backed by SSM Parameter Store (SecureString).
//
// Set SSM_PARAMETER_PREFIX (e.g. "/hartnell-mailer/prod") to read secrets from SSM.
// Parameter names are `${prefix}/${NAME}`, e.g. /hartnell-mailer/prod/DUO_CLIENT_SECRET.
// When the prefix is unset (local dev), it falls back to process.env[NAME].
//
// Values are cached in memory so SSM is hit once per secret per process.

const globalSecretState = globalThis as typeof globalThis & {
  __hartnellMailerSecrets?: Map<string, Promise<string>>;
  __hartnellMailerSsm?: SSMClient;
};

const cache = (globalSecretState.__hartnellMailerSecrets ??= new Map());

function ssmClient(): SSMClient {
  return (globalSecretState.__hartnellMailerSsm ??= new SSMClient({
    region: process.env.AWS_REGION ?? "us-west-2",
  }));
}

async function fetchSecret(name: string): Promise<string> {
  const prefix = process.env.SSM_PARAMETER_PREFIX?.trim().replace(/\/+$/, "");

  if (!prefix) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing secret ${name} (set it in .env for local dev).`);
    return value;
  }

  const response = await ssmClient().send(
    new GetParameterCommand({ Name: `${prefix}/${name}`, WithDecryption: true })
  );
  const value = response.Parameter?.Value?.trim();
  if (!value) throw new Error(`SSM parameter ${prefix}/${name} is empty or missing.`);
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
