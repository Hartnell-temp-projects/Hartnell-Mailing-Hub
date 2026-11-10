import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import {
  clearOidcTransactionCookie,
  readOidcTransaction,
  setSessionCookie,
} from "@/lib/auth/session";
import { getDuoConfiguration, getDuoRedirectUri } from "@/lib/auth/config";

export const runtime = "nodejs";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Behind Amplify, request.url reflects the internal server address (https://localhost:3000),
// not the public hostname. Derive everything public-facing from the configured redirect URI.
function publicUrl(path: string): URL {
  return new URL(path, getDuoRedirectUri());
}

function failedLoginResponse() {
  // Not a secret; logging the origin confirms which DUO_REDIRECT_URI the runtime actually sees.
  console.error(`Duo login failed; redirecting to ${publicUrl("/").origin}`);
  const response = NextResponse.redirect(publicUrl("/?authError=login_failed"));
  clearOidcTransactionCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  // Public callback URL (what Duo redirected to) + the query params Duo sent.
  const callbackUrl = publicUrl(getDuoRedirectUri());
  callbackUrl.search = request.nextUrl.search;

  const returnedState = callbackUrl.searchParams.get("state");

  try {
    const transaction = await readOidcTransaction(request);
    if (!transaction) {
      console.error("Duo callback failed: OIDC transaction cookie missing, expired, or undecryptable.");
      return failedLoginResponse();
    }
    if (!returnedState || returnedState !== transaction.state) {
      console.error("Duo callback failed: state in callback URL does not match transaction cookie.");
      return failedLoginResponse();
    }

    const configuration = await getDuoConfiguration();
    const tokens = await oidc.authorizationCodeGrant(
      configuration,
      callbackUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
      }
    );

    const claims = tokens.claims();
    const subject = readString(claims?.sub);
    if (!subject) {
      throw new Error("Duo did not return the required identity information.");
    }

    const response = NextResponse.redirect(publicUrl("/"));
    clearOidcTransactionCookie(response);
    await setSessionCookie(response, {
      subject,
      email: readString(claims?.email),
      name: readString(claims?.name),
    });
    return response;
  } catch (error) {
    console.error("Duo callback failed:", error);
    return failedLoginResponse();
  }
}
