import { NextResponse } from "next/server";
import * as oidc from "openid-client";
import { setOidcTransactionCookie } from "@/lib/auth/session";
import { getDuoConfiguration, getDuoRedirectUri, getDuoScope } from "@/lib/auth/config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const configuration = await getDuoConfiguration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const nonce = oidc.randomNonce();
    const state = oidc.randomState();

    const authorizationUrl = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: getDuoRedirectUri(),
      response_type: "code",
      scope: getDuoScope(),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    const response = NextResponse.redirect(authorizationUrl);
    await setOidcTransactionCookie(response, { state, codeVerifier, nonce });
    return response;
  } catch (error) {
    console.error("Duo login could not be started:", error);
    return NextResponse.json(
      { error: "Duo authentication is not configured correctly." },
      { status: 500 }
    );
  }
}
