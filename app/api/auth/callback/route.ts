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

function failedLoginResponse(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/?authError=login_failed", request.url)
  );
  clearOidcTransactionCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  const returnedState = new URL(request.url).searchParams.get("state");
  const cookieState = request.cookies.get(OIDC_TRANSACTION_COOKIE)?.value;

  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return failedLoginResponse(request);
  }

  const transaction = consumeOidcTransaction(returnedState);
  if (!transaction) {
    return failedLoginResponse(request);
  }

  try {
    const configuration = await getDuoConfiguration();
    const tokens = await oidc.authorizationCodeGrant(
      configuration,
      new URL(request.url),
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
      },
      { redirect_uri: getDuoRedirectUri() }
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

    const response = NextResponse.redirect(new URL("/", request.url));
    clearOidcTransactionCookie(response);
    setSessionCookie(response, session.id);
    return response;
  } catch (error) {
    console.error("Duo callback failed:", error);
    return failedLoginResponse(request);
  }
}
