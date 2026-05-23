export function VibeClipLogo({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] shadow-sm">
        <svg
          viewBox="0 0 40 40"
          className="h-7 w-7"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 11L18.2 29L30 11"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M18.5 15.5L28 20L18.5 24.5V15.5Z" fill="#7C3AED" />
          <path
            d="M31 14C33.2 17.5 33.2 22.5 31 26"
            stroke="#A78BFA"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M34 10C38 16 38 24 34 30"
            stroke="#C4B5FD"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {!compact && (
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold tracking-tight ${tone === 'light' ? 'text-white' : 'text-neutral-950'}`}>
            VibeClip
          </span>
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
            维播
          </span>
        </div>
      )}
    </div>
  );
}
