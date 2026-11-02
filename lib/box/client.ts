import { BoxCcgAuth, BoxClient, CcgConfig } from "box-node-sdk";

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
  __hartnellMailerBoxClient?: BoxClient;
};

export function getBoxClient(): BoxClient {
  if (!globalBoxState.__hartnellMailerBoxClient) {
    const auth = new BoxCcgAuth({
      config: new CcgConfig({
        clientId: requiredEnvironmentVariable("BOX_CLIENT_ID"),
        clientSecret: requiredEnvironmentVariable("BOX_CLIENT_SECRET"),
        enterpriseId: requiredEnvironmentVariable("BOX_ENTERPRISE_ID"),
      }),
    });

    globalBoxState.__hartnellMailerBoxClient = new BoxClient({ auth });
  }

  return globalBoxState.__hartnellMailerBoxClient;
}

export function getBoxRootFolderId(): string {
  return requiredEnvironmentVariable("BOX_ROOT_FOLDER_ID");
}
