export default function Loading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 5% 0%, rgba(212,175,90,0.10) 0%, transparent 55%), " +
          "radial-gradient(ellipse at 95% 100%, rgba(212,175,90,0.07) 0%, transparent 50%)",
      }}
    >
      <div className="flex flex-col items-center gap-5 select-none">

        {/* Gold arc spinner — same arc style as score badge */}
        <div className="relative w-16 h-16">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            className="animate-spin"
            style={{ animationDuration: "1.4s", animationTimingFunction: "linear" }}
          >
            {/* Faint track ring */}
            <circle
              cx="32" cy="32" r="26"
              fill="none"
              stroke="rgba(201,168,92,0.14)"
              strokeWidth="3.5"
            />
            {/* Spinning arc — ~35% of circumference */}
            <circle
              cx="32" cy="32" r="26"
              fill="none"
              stroke="#C9A85C"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="57 106"
              transform="rotate(-90 32 32)"
            />
          </svg>

          {/* GE inside the ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-display text-[11px] font-bold tracking-wider"
              style={{ color: "#C9A85C" }}
            >
              GE
            </span>
          </div>
        </div>

        {/* Subtle label */}
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "rgba(201,168,92,0.55)" }}
        >
          Loading
        </p>

      </div>
    </div>
  )
}
