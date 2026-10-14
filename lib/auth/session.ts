import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "hartnell_mailer_session";
export const OIDC_TRANSACTION_COOKIE = "hartnell_mailer_oidc_transaction";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const OIDC_TRANSACTION_TTL_SECONDS = 10 * 60;

export interface AuthSession {
  id: string;
  subject: string;
  email?: string;
  name?: string;
  accessToken: string;
  refreshToken?: string;
  createdAt: number;
  expiresAt: number;
}

interface OidcTransaction {
  state: string;
  codeVerifier: string;
  nonce: string;
  createdAt: number;
}

// This keeps tokens on the server instead of placing them in the browser.
// globalThis lets separately bundled Next.js route handlers share the store
// during local development. A shared store such as Redis is still required
// before deploying multiple application instances.
interface AuthState {
  sessions: Map<string, AuthSession>;
  oidcTransactions: Map<string, OidcTransaction>;
}

const globalAuthState = globalThis as typeof globalThis & {
  __hartnellMailerAuthState?: AuthState;
};

const authState =
  globalAuthState.__hartnellMailerAuthState ??
  (globalAuthState.__hartnellMailerAuthState = {
    sessions: new Map<string, AuthSession>(),
    oidcTransactions: new Map<string, OidcTransaction>(),
  });

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function removeExpiredEntries() {
  const now = Date.now();

  for (const [id, session] of authState.sessions) {
    if (session.expiresAt <= now) {
      authState.sessions.delete(id);
    }
  }

  for (const [state, transaction] of authState.oidcTransactions) {
    if (
      transaction.createdAt + OIDC_TRANSACTION_TTL_SECONDS * 1000 <=
      now
    ) {
      authState.oidcTransactions.delete(state);
    }
  }
}

export function createOidcTransaction(codeVerifier: string, nonce: string): string {
  removeExpiredEntries();

  const state = randomUUID();
  authState.oidcTransactions.set(state, {
    state,
    codeVerifier,
    nonce,
    createdAt: Date.now(),
  });

  return state;
}

export function consumeOidcTransaction(
  state: string
): OidcTransaction | undefined {
  removeExpiredEntries();

  const transaction = authState.oidcTransactions.get(state);
  authState.oidcTransactions.delete(state);

  return transaction;
}

export function createSession(input: {
  subject: string;
  email?: string;
  name?: string;
  accessToken: string;
  refreshToken?: string;
}): AuthSession {
  removeExpiredEntries();

  const now = Date.now();
  const session: AuthSession = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };

  authState.sessions.set(session.id, session);
  return session;
}

export function getSession(request: NextRequest): AuthSession | undefined {
  removeExpiredEntries();

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return undefined;
  }

  return authState.sessions.get(sessionId);
}

export function deleteSession(request: NextRequest): void {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    authState.sessions.delete(sessionId);
  }
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE, sessionId, cookieOptions(SESSION_TTL_SECONDS));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}

export function setOidcTransactionCookie(
  response: NextResponse,
  state: string
): void {
  response.cookies.set(
    OIDC_TRANSACTION_COOKIE,
    state,
    cookieOptions(OIDC_TRANSACTION_TTL_SECONDS)
  );
}

export function clearOidcTransactionCookie(response: NextResponse): void {
  response.cookies.set(OIDC_TRANSACTION_COOKIE, "", cookieOptions(0));
}
