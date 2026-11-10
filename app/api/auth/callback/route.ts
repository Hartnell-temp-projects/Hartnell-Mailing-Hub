import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import {
  clearOidcTransactionCookie,
  consumeOidcTransaction,
  createSession,
  OIDC_TRANSACTION_COOKIE,
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
  const response = NextResponse.redirect(publicUrl("/?authError=login_failed"));
  clearOidcTransactionCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  // Public callback URL (what Duo redirected to) + the query params Duo sent.
  const callbackUrl = publicUrl(getDuoRedirectUri());
  callbackUrl.search = request.nextUrl.search;

  const returnedState = callbackUrl.searchParams.get("state");
  const cookieState = request.cookies.get(OIDC_TRANSACTION_COOKIE)?.value;

  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return failedLoginResponse();
  }

  const transaction = consumeOidcTransaction(returnedState);
  if (!transaction) {
    return failedLoginResponse();
  }

  try {
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
    if (!subject || !tokens.access_token) {
      throw new Error("Duo did not return the required identity information.");
    }

    const session = createSession({
      subject,
      email: readString(claims?.email),
      name: readString(claims?.name),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    const response = NextResponse.redirect(publicUrl("/"));
    clearOidcTransactionCookie(response);
    setSessionCookie(response, session.id);
    return response;
  } catch (error) {
    console.error("Duo callback failed:", error);
    return failedLoginResponse();
  }
}
