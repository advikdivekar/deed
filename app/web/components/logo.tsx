/** DeedReader mark: a parcel outline with its point of beginning, on the dark-teal tile. */
export function Logo({ size = 32, word = true, tone = "auto" }: { size?: number; word?: boolean; tone?: "auto" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0 rounded-[28%] shadow-[0_6px_18px_-8px_rgb(0_49_53/.6)]">
        <rect width="48" height="48" fill="#003135" />
        <path d="M11 33 L17 14 L36 11 L38 30 Z" fill="rgb(15 164 175 / .18)" stroke="#6FD6DE" strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="11" cy="33" r="4" fill="#0FA4AF" stroke="#003135" strokeWidth="1.5" />
      </svg>
      {word && <span className={`wordmark leading-none ${tone === "light" ? "text-[#F5F8F8]" : ""}`} style={{ fontSize: size * 0.7 }}>deedreader</span>}
    </span>
  );
}
