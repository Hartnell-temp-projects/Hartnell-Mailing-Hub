import { BoxCcgAuth, BoxClient, CcgConfig } from "box-node-sdk";
import { getSecret } from "@/lib/secrets";

// Server-only Box client. It authenticates as the Box app's service account
// using Client Credentials Grant, so no Box credentials ever reach the browser.

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const globalBoxState = globalThis as typeof globalThis & {
  __hartnellMailerBoxClient?: Promise<BoxClient>;
};

export function getBoxClient(): Promise<BoxClient> {
  if (!globalBoxState.__hartnellMailerBoxClient) {
    globalBoxState.__hartnellMailerBoxClient = getSecret("BOX_CLIENT_SECRET")
      .then((clientSecret) => {
        const auth = new BoxCcgAuth({
          config: new CcgConfig({
            clientId: requiredEnvironmentVariable("BOX_CLIENT_ID"),
            clientSecret,
            enterpriseId: requiredEnvironmentVariable("BOX_ENTERPRISE_ID"),
          }),
        });
        return new BoxClient({ auth });
      })
      .catch((error) => {
        globalBoxState.__hartnellMailerBoxClient = undefined;
        throw error;
      });
  }

  return globalBoxState.__hartnellMailerBoxClient;
}

export function getBoxRootFolderId(): string {
  return requiredEnvironmentVariable("BOX_ROOT_FOLDER_ID");
}
