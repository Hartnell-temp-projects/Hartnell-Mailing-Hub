"use client";

import { useState } from "react";
import ComposeForm from "@/components/ComposeForm";
import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";

export default function Home() {
  const [currentView, setCurrentView] = useState<"compose" | "dashboard">("compose");

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
