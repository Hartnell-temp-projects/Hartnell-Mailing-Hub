import type { NextRequest, NextResponse } from "next/server";
import { EncryptJWT, jwtDecrypt } from "jose";
import { getSecret } from "@/lib/secrets";

// Stateless sessions: the session and the in-flight OIDC transaction live in
// encrypted cookies (JWE, dir + A256GCM), so any server instance can read them.
// This works on serverless hosts where in-memory state does not survive between requests.
//
// SESSION_SECRET must be a base64-encoded 32-byte key, e.g. `openssl rand -base64 32`.
// Logout clears the cookie but cannot revoke a copied one before it expires;
// rotating SESSION_SECRET invalidates every session.

export const SESSION_COOKIE = "hartnell_mailer_session";
export const OIDC_TRANSACTION_COOKIE = "hartnell_mailer_oidc_transaction";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const OIDC_TRANSACTION_TTL_SECONDS = 10 * 60;

// Audiences keep one cookie type from being accepted as the other.
const SESSION_AUDIENCE = "hartnell-mailer:session";
const TRANSACTION_AUDIENCE = "hartnell-mailer:oidc-transaction";

export interface AuthSession {
  subject: string;
  email?: string;
  name?: string;
}

export interface OidcTransaction {
  state: string;
  codeVerifier: string;
  nonce: string;
}

async function getKey(): Promise<Uint8Array> {
  const key = Buffer.from(await getSecret("SESSION_SECRET"), "base64");
  if (key.length !== 32) {
    throw new Error("SESSION_SECRET must be a base64-encoded 32-byte key.");
  }
  return new Uint8Array(key);
}

async function seal(
  payload: Record<string, unknown>,
  audience: string,
  ttlSeconds: number
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(await getKey());
}

/** Returns the payload, or undefined if the cookie is missing, tampered with, or expired. */
async function unseal(
  token: string | undefined,
  audience: string
): Promise<Record<string, unknown> | undefined> {
  if (!token) return undefined;

  try {
    const { payload } = await jwtDecrypt(token, await getKey(), {
      audience,
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return payload;
  } catch (error) {
    // A bad cookie means "not logged in". A missing/invalid key is a server problem; surface it.
    if (error instanceof Error && error.message.includes("SESSION_SECRET")) throw error;
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setOidcTransactionCookie(
  response: NextResponse,
  transaction: OidcTransaction
): Promise<void> {
  response.cookies.set(
    OIDC_TRANSACTION_COOKIE,
    await seal({ ...transaction }, TRANSACTION_AUDIENCE, OIDC_TRANSACTION_TTL_SECONDS),
    cookieOptions(OIDC_TRANSACTION_TTL_SECONDS)
  );
}

export async function readOidcTransaction(
  request: NextRequest
): Promise<OidcTransaction | undefined> {
  const payload = await unseal(
    request.cookies.get(OIDC_TRANSACTION_COOKIE)?.value,
    TRANSACTION_AUDIENCE
  );
  const state = asString(payload?.state);
  const codeVerifier = asString(payload?.codeVerifier);
  const nonce = asString(payload?.nonce);

  return state && codeVerifier && nonce ? { state, codeVerifier, nonce } : undefined;
}

export function clearOidcTransactionCookie(response: NextResponse): void {
  response.cookies.set(OIDC_TRANSACTION_COOKIE, "", cookieOptions(0));
}

export async function setSessionCookie(
  response: NextResponse,
  session: AuthSession
): Promise<void> {
  response.cookies.set(
    SESSION_COOKIE,
    await seal({ ...session }, SESSION_AUDIENCE, SESSION_TTL_SECONDS),
    cookieOptions(SESSION_TTL_SECONDS)
  );
}

export async function getSession(request: NextRequest): Promise<AuthSession | undefined> {
  const payload = await unseal(request.cookies.get(SESSION_COOKIE)?.value, SESSION_AUDIENCE);
  const subject = asString(payload?.subject);
  if (!subject) return undefined;

  return { subject, email: asString(payload?.email), name: asString(payload?.name) };
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}
