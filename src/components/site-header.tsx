import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Search, Sun, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/scout-logo.png";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Byt ljust/mörkt läge">
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}

export function SearchBox({ initial = "", big = false }: { initial?: string; big?: boolean }) {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate({ to: "/sok", search: { q: q.trim() } });
      }}
      className={`flex items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${big ? "h-14 text-lg" : "h-10 text-sm"}`}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Sök spelare, tränare eller liga"
        className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        aria-label="Sök"
      />
      {big && <Button type="submit">Sök</Button>}
    </form>
  );
}

export function SiteHeader() {
  // Sidhuvudet finns kvar när man byter sida, och det gör sökrutans text också. Nyckeln byts vid
  // varje navigering (ny sida, tillbaka-knappen, loggan) så att rutan alltid börjar tom.
  const href = useRouterState({ select: (s) => s.location.href });
  const [resets, setResets] = useState(0);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <nav className="flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link to="/fifa">FIFA</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/uefa">UEFA</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/matcher">Matcher</Link>
          </Button>
        </nav>
        <Link to="/" className="flex items-center gap-2" onClick={() => setResets((n) => n + 1)}>
          <img src={logo} alt="" width={32} height={32} className="size-8" />
          <span className="font-display text-2xl font-extrabold">
            Free Role <span className="text-primary">Lab</span>
          </span>
        </Link>
        <div className="hidden flex-1 md:block">
          <SearchBox key={`${href}#${resets}`} />
        </div>
        <nav className="ml-auto flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link to="/chat">
              <MessageSquare className="size-4" /> AI-chatt
            </Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
