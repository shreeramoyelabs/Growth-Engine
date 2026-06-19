export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{
        background:
          "radial-gradient(1200px 800px at 20% 10%, rgba(255,235,170,0.45), transparent 60%), radial-gradient(1000px 700px at 85% 90%, rgba(201,168,92,0.18), transparent 60%), linear-gradient(180deg, #FFFBF0 0%, #FFF6E0 100%)",
      }}
    >
      {/* Top gold accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent opacity-60" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-baseline gap-2.5">
            <span className="font-display text-[42px] font-bold tracking-tight text-foreground">GE</span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1"
              style={{ color: "#C9A85C" }}
            >
              Intel
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Growth Engine</p>
        </div>
        {children}
      </div>
    </div>
  )
}
