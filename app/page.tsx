import Header from "@/components/Header";
import ComposeForm from "@/components/ComposeForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-7xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Compose Message</h2>
            <p className="text-slate-500 text-sm mt-1">
              Send an email to staff, faculty, or students via the college mail system.
            </p>
          </div>
          <ComposeForm />
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        Internal use only &mdash; Unauthorized use is prohibited.
      </footer>
    </div>
  );
}
