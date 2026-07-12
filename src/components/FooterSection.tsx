export default function FooterSection() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <svg
            className="w-5 h-5 text-accent"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2 C14 5 14 9 12 12 C10 15 10 19 12 22" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M4 7 C7 8 10 9 12 12 C14 15 17 16 20 17" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M4 17 C7 16 10 15 12 12 C14 9 17 8 20 7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span>Stitches<span className="text-accent">&amp;</span>Stats</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono text-center">
          Built with Next.js 16, TypeScript &amp; WebSockets. Data for fan use only. Not affiliated with MLB.
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          &copy; {new Date().getFullYear()} Stitches &amp; Stats
        </p>
      </div>
    </footer>
  );
}
