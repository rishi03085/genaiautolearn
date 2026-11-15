import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Flame, Hammer, ScrollText, Brain, Network, Clock3 } from "lucide-react";
import { initAnalytics } from "@/lib/firebase";
import { MODEL } from "@/config/llm";

const NAV = [
  { to: "/", label: "Forge", icon: Hammer },
  { to: "/history", label: "History", icon: Clock3 },
  { to: "/rejections", label: "Rejections", icon: ScrollText },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/architecture", label: "Architecture", icon: Network },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5 font-display text-xl font-extrabold">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forge text-primary-foreground shadow-forge">
        <Flame className="h-4 w-4" />
      </span>
      <span className="truncate">LessonForge</span>
    </Link>
  );
}

/**
 * Dashboard shell: dark sidebar on laptops/desktops (lg+),
 * top bar + bottom tab bar on phones and tablets.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  useEffect(() => { void initAnalytics().catch(() => {}); }, []);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink p-5 text-ink-foreground lg:flex">
        <Logo />
        <nav className="mt-10 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-foreground/70 transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground"
              activeProps={{ className: "bg-ink-foreground/10 !text-ink-foreground font-semibold" }}>
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-ink-foreground/15 p-3 text-xs text-ink-foreground/60">
          <p className="font-semibold text-ink-foreground/90">Model</p>
          <p className="truncate font-mono">{MODEL}</p>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar (mobile/tablet) */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Bottom tabs (mobile/tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: true }}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "!text-primary font-semibold" }}>
            <Icon className="h-5 w-5" /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
