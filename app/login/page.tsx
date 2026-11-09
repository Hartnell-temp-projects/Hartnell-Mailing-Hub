"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const loggedOut = searchParams.get("loggedOut") === "1";

  useEffect(() => {
    if (loggedOut) {
      window.history.replaceState({}, "", "/login");
    }
  }, [loggedOut]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#8c1d40] px-6 py-7 text-white">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Hartnell Email Provider</h1>
                <p className="text-xs font-medium text-white/75">Internal communications</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-white/85">
              Sign in with your Hartnell account to create and send email communications.
            </p>
          </div>

          <div className="space-y-5 px-6 py-7">
            {loggedOut && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
              >
                You have successfully logged out.
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {loggedOut ? "You’re signed out" : "Welcome back"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {loggedOut
                  ? "Your Hartnell Mailer session has ended. Sign in again whenever you are ready."
                  : "Continue to Duo to securely sign in with multi-factor authentication."}
              </p>
            </div>

            <a
              href="/api/auth/login"
              className="flex w-full items-center justify-center rounded-lg bg-[#ffc627] px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#e6ae22] focus:outline-none focus:ring-2 focus:ring-[#8c1d40] focus:ring-offset-2"
            >
              Log in with Duo
            </a>

            <p className="text-center text-xs leading-5 text-slate-400">
              You will be redirected to Duo to complete your sign-in.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
