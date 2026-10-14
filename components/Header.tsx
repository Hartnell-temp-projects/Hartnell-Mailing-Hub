"use client";

import { useEffect, useState } from "react";

interface Props {
  currentView: "compose" | "dashboard";
  onNavigate: (view: "compose" | "dashboard") => void;
}

interface AuthUser {
  name?: string;
  email?: string;
}

export default function Header({ currentView, onNavigate }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin",
        });

        if (response.ok) {
          const data = (await response.json()) as {
            user?: AuthUser;
          };
          if (!cancelled) {
            setUser(data.user ?? null);
          }
        }
      } catch {
        // The header can still render if the session endpoint is unavailable.
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    if (response.ok) {
      setUser(null);
      window.location.replace("/?loggedOut=1");
    } else {
      window.alert("We could not complete logout. Please try again.");
    }
  };

  return (
    <header className="bg-[#8c1d40] text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20">
          <svg
            className="w-5 h-5 text-white"
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
          <h1 className="text-lg font-bold leading-tight tracking-tight">
            Hartnell Email Provider
          </h1>
          <p className="text-xs text-gray-200 font-medium">
            Internal Communications — Powered by AWS SES
          </p>
        </div>
        <nav className="ml-auto flex items-center gap-1" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => onNavigate("compose")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              currentView === "compose"
                ? "bg-white text-[#8c1d40]"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            Compose
          </button>
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              currentView === "dashboard"
                ? "bg-white text-[#8c1d40]"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            Dashboard
          </button>
          {!authLoading && !user && (
            <a
              href="/api/auth/login"
              className="ml-2 rounded-lg bg-[#ffc627] px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#e6ae22]"
            >
              Log in with Duo
            </a>
          )}
          {!authLoading && user && (
            <div className="ml-2 flex items-center gap-2">
              <span className="hidden text-xs text-white/80 sm:inline" title={user.email}>
                {user.name || user.email || "Signed in"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Log out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
