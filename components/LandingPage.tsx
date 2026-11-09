"use client";

export default function LandingPage({ loggedOut = false }: { loggedOut?: boolean }) {
  return (
    <main className="min-h-screen bg-white px-5 py-12 text-slate-800 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl flex-col items-center justify-center">
        <div className="mb-10 text-center">
          <div className="mb-5 flex items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8c1d40] text-white shadow-sm">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-3xl font-black tracking-tight text-[#8c1d40] sm:text-4xl">
                HARTNELL
              </p>
              <p className="text-2xl font-semibold tracking-[0.28em] text-slate-900 sm:text-3xl">
                COLLEGE
              </p>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#59002f] sm:text-4xl">
            Hartnell Email Provider
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Secure internal communications for the Hartnell community.
          </p>
        </div>

        <section className="w-[900px] max-w-[calc(100vw-2rem)] rounded-[2rem] bg-[#8c1d40] px-6 py-11 text-center shadow-xl shadow-slate-300/70 sm:px-16">
          {loggedOut && (
            <div
              role="status"
              aria-live="polite"
              className="mx-auto mb-8 max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
            >
              You have successfully logged out.
            </div>
          )}
          
          <p className="mx-auto text-base leading-7 text-white/85 sm:text-lg">
            Sign in with your Hartnell account to create, preview, and send internal email communications.
          </p>

          <a
            href="/api/auth/login"
            className="mx-auto mt-8 flex w-[600px] max-w-full items-center justify-center rounded-xl bg-[#ffc627] px-6 py-4 text-lg font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#e6ae22] focus:outline-none focus:ring-2 focus:ring-[#ffc627] focus:ring-offset-2 focus:ring-offset-[#8c1d40]"
          >
            Log in with Duo
            <svg
              className="ml-3 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>

          <p className="mt-6 text-sm text-white/65">
            You will be redirected to Duo to complete multi-factor authentication.
          </p>
        </section>

        <p className="mt-10 text-sm text-slate-400">
          Internal use only &mdash; Unauthorized use is prohibited.
        </p>
      </div>
    </main>
  );
}
