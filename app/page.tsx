"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ComposeForm from "@/components/ComposeForm";
import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";
import LandingPage from "@/components/LandingPage";

type AuthState = "loading" | "authenticated" | "unauthenticated";

function HomeContent() {
  const searchParams = useSearchParams();
  const loggedOut = searchParams.get("loggedOut") === "1";
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [currentView, setCurrentView] = useState<"compose" | "dashboard">("compose");

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!cancelled) {
          setAuthState(response.ok ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (!cancelled) {
          setAuthState("unauthenticated");
        }
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <p className="text-sm font-medium text-slate-500">Checking your session…</p>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return <LandingPage loggedOut={loggedOut} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header currentView={currentView} onNavigate={setCurrentView} />

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-7xl">
          {currentView === "compose" ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Compose Message</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Send an email to staff, faculty, or students via the college mail system.
                </p>
              </div>
              <ComposeForm />
            </>
          ) : (
            <Dashboard onCompose={() => setCurrentView("compose")} />
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        Internal use only &mdash; Unauthorized use is prohibited.
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <p className="text-sm font-medium text-slate-500">Loading Hartnell Mailer…</p>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
