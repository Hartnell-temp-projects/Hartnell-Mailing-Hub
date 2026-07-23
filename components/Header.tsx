export default function Header() {
  return (
    <header className="bg-[#8c1d40] text-white shadow-md">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
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
      </div>
    </header>
  );
}
