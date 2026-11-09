import * as oidc from "openid-client";
import { getSecret } from "@/lib/secrets";

let configurationPromise: Promise<oidc.Configuration> | undefined;

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDuoRedirectUri(): string {
  return requiredEnvironmentVariable("DUO_REDIRECT_URI");
}

export async function getDuoConfiguration(): Promise<oidc.Configuration> {
  if (!configurationPromise) {
    const issuer = requiredEnvironmentVariable("DUO_ISSUER");
    const clientId = requiredEnvironmentVariable("DUO_CLIENT_ID");

    configurationPromise = getSecret("DUO_CLIENT_SECRET")
      .then((clientSecret) => oidc.discovery(new URL(issuer), clientId, clientSecret))
      .catch((error) => {
        configurationPromise = undefined;
        throw error;
      });
  }

  return configurationPromise;
}

export function getDuoScope(): string {
  return process.env.DUO_SCOPE?.trim() || "openid profile email";
}
