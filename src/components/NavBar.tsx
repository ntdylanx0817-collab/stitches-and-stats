export default function NavBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 font-bold text-foreground">
          <svg
            className="w-6 h-6 text-accent"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 2 C14 5 14 9 12 12 C10 15 10 19 12 22"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M4 7 C7 8 10 9 12 12 C14 15 17 16 20 17"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M4 17 C7 16 10 15 12 12 C14 9 17 8 20 7"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
          <span>Stitches<span className="text-accent">&amp;</span>Stats</span>
        </a>

        {/* Nav links */}
        <nav aria-label="Main navigation">
          <ul className="hidden md:flex items-center gap-6 text-sm text-muted-foreground font-medium">
            {[
              { href: "#features", label: "Features" },
              { href: "#leaderboards", label: "Leaderboards" },
            ].map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA */}
        <a
          href="#features"
          className="text-sm font-semibold bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors"
        >
          Get Started
        </a>
      </div>
    </header>
  );
}
