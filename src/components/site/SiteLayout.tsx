import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Mail, MessageCircle, Phone, Radio, Search, Facebook, Youtube, Instagram, Menu, X } from "lucide-react";
import logo from "@/assets/serbia15-logo.jpg";
import { getSettings } from "@/lib/news.functions";
import { ratioCss } from "@/lib/image-ratio";
import { useAuth } from "@/lib/auth";
import { AdSlot } from "./AdSlot";

export const NAV = [
  { slug: "nigeria", ha: "Najeriya", en: "Nigeria" },
  { slug: "international", ha: "Duniya", en: "International" },
  { slug: "politics", ha: "Siyasa", en: "Politics" },
  { slug: "business", ha: "Kuɗi", en: "Business" },
  { slug: "education", ha: "Ilimi", en: "Education" },
  { slug: "security", ha: "Tsaro", en: "Security" },
  { slug: "entertainment", ha: "Nishaɗi", en: "Entertainment" },
  { slug: "sports", ha: "Wasanni", en: "Sports" },
] as const;

export const settingsQuery = { queryKey: ["settings"], queryFn: () => getSettings(), staleTime: 60_000 };

function Header() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { session, isStaff } = useAuth();
  const navLink =
    "group flex flex-col justify-center whitespace-nowrap px-3 py-1.5 leading-tight hover:bg-navy-deep active:bg-brand";
  const activeProps = { className: "bg-brand" };
  return (
    <header className="sticky top-0 z-40 bg-background shadow-sm">
      <div className="bg-navy-deep text-navy-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2" aria-label="Serbia 15 Online News home">
            <img src={logo} alt="" width={44} height={44} className="h-10 w-10 shrink-0 rounded-full bg-background sm:h-11 sm:w-11" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-sm font-black tracking-tight sm:text-lg">SERBIA 15 ONLINE NEWS</span>
              <span className="block truncate text-[10px] uppercase tracking-widest opacity-80 sm:text-[11px]">Tashar Al'ummah</span>
            </span>
          </Link>
          <form
            className="ml-auto hidden max-w-sm flex-1 md:flex"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/search", search: { q: q.trim() || undefined } });
            }}
          >
            <label htmlFor="site-search" className="sr-only">Search news — Bincika labarai</label>
            <input
              id="site-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Bincika labarai & bidiyo…"
              className="w-full rounded-l-sm border-0 bg-navy-foreground/10 px-3 py-2 text-sm text-navy-foreground placeholder:text-navy-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button className="rounded-r-sm bg-brand px-3 text-brand-foreground" aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
          </form>
          <Link
            to="/live"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-brand px-2.5 py-2 text-xs font-bold uppercase text-brand-foreground sm:px-3 sm:text-sm md:ml-0"
          >
            <Radio className="h-4 w-4" /> <span className="hidden sm:inline">Live ·</span> Kai tsaye
          </Link>
          {session && (
            <Link to="/dashboard" className="hidden text-sm font-medium opacity-90 hover:opacity-100 sm:inline">
              {isStaff ? "Newsroom" : "My account"}
            </Link>
          )}
          <button className="shrink-0 md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <nav className="border-b-4 border-brand bg-navy text-navy-foreground" aria-label="Sections">
        <div className="mx-auto flex max-w-7xl gap-0.5 overflow-x-auto px-2 text-sm font-semibold [scrollbar-width:none]">
          <Link to="/" className={navLink} activeOptions={{ exact: true }} activeProps={activeProps}>
            <span>Babban Shafi</span>
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Home</span>
          </Link>
          {NAV.map((n) => (
            <Link key={n.slug} to="/category/$slug" params={{ slug: n.slug }} className={navLink} activeProps={activeProps}>
              <span>{n.ha}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{n.en}</span>
            </Link>
          ))}
          <Link to="/videos" search={{ format: "interview" }} className={navLink} activeProps={activeProps}>
            <span>Hira</span>
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Interviews</span>
          </Link>
          <Link to="/videos" search={{ format: "documentary" }} className={navLink} activeProps={activeProps}>
            <span>Kasidoli</span>
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Documentaries</span>
          </Link>
          <Link to="/videos" className={navLink} activeProps={activeProps}>
            <span>Bidiyo</span>
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Videos</span>
          </Link>
        </div>
      </nav>
      {open && (
        <div className="border-b bg-background p-4 md:hidden">
          <form
            role="search"
            className="flex"
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
              navigate({ to: "/search", search: { q: q.trim() || undefined } });
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bincika labarai & bidiyo…" aria-label="Search news — Bincika labarai" className="w-full min-w-0 rounded-l-sm border px-3 py-2 text-base" />
            <button className="rounded-r-sm bg-brand px-3 text-brand-foreground" aria-label="Search"><Search className="h-4 w-4" /></button>
          </form>
          {session && (
            <Link to="/dashboard" onClick={() => setOpen(false)} className="mt-3 block text-sm font-semibold text-primary">
              Go to newsroom
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { data: s } = useQuery(settingsQuery);
  const socials = [
    { href: s?.facebook_page_url ?? "https://www.facebook.com/share/1DndT6AgUx/", label: "Facebook", Icon: Facebook },
    s?.youtube_url ? { href: s.youtube_url, label: "YouTube", Icon: Youtube } : null,
    s?.instagram_url ? { href: s.instagram_url, label: "Instagram", Icon: Instagram } : null,
    s?.x_url ? { href: s.x_url, label: "X", Icon: X } : null,
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Facebook }[];
  return (
    <footer className="mt-16 bg-navy-deep text-navy-foreground">
      <div className="h-1 bg-brand" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img src={logo} alt="Serbia 15 Online News logo" width={64} height={64} className="h-16 w-16 rounded-full bg-background" loading="lazy" />
            <div>
              <p className="font-display text-xl font-black">Serbia 15 Online News</p>
              <p className="text-sm opacity-80">Tashar Al'ummah</p>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            {socials.map(({ href, label, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="rounded-full bg-navy-foreground/10 p-2.5 hover:bg-brand">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-brand">Sashe · Sections</h2>
          <ul className="grid grid-cols-2 gap-1.5 text-sm">
            {NAV.map((n) => (
              <li key={n.slug}>
                <Link to="/category/$slug" params={{ slug: n.slug }} className="opacity-85 hover:underline">
                  {n.ha} <span className="opacity-60">({n.en})</span>
                </Link>
              </li>
            ))}
            <li><Link to="/videos" className="opacity-85 hover:underline">Bidiyo (Videos)</Link></li>
            <li><Link to="/live" className="opacity-85 hover:underline">Kai tsaye (Live TV)</Link></li>
            <li><Link to="/search" className="opacity-85 hover:underline">Bincika labarai (Archive)</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-brand">Tuntube mu · Contact the newsroom</h2>
          {s?.org_phone || s?.org_email || s?.org_whatsapp || s?.org_address ? (
            <>
              {s.org_address && <p className="text-sm">{s.org_address}</p>}
              {s.org_phone && <p className="text-sm">Phone: {s.org_phone}</p>}
              {s.org_email && <p className="text-sm break-all">Email: {s.org_email}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {s.org_phone && <a href={`tel:${s.org_phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-sm bg-navy-foreground px-3 py-2 text-sm font-semibold text-navy-deep"><Phone className="h-4 w-4" /> Call</a>}
                {s.org_whatsapp && <a href={`https://wa.me/${s.org_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
                {s.org_email && <a href={`mailto:${s.org_email}`} className="inline-flex items-center gap-1.5 rounded-sm border border-navy-foreground/40 px-3 py-2 text-sm font-semibold"><Mail className="h-4 w-4" /> Email</a>}
              </div>
            </>
          ) : (
            <p className="text-sm opacity-80">Reach us on our social pages.</p>
          )}
        </div>
      </div>
      <div className="border-t border-navy-foreground/15 px-4 py-4 text-center text-xs opacity-80">
        <p>© {new Date().getFullYear()} Serbia 15 Online News — Tashar Al'ummah. All rights reserved.</p>
        <p className="mt-1.5">
          Website Designed By <strong>Baffah Muhammad</strong> ·{" "}
          <a href="tel:08148129939" className="underline">08148129939</a> ·{" "}
          <a href="https://wa.me/2348148129939" target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a> ·{" "}
          <a href="mailto:baffahmuhammad0@gmail.com" className="underline break-all">baffahmuhammad0@gmail.com</a>
        </p>
      </div>
    </footer>
  );
}

export function SiteLayout({ children, ticker }: { children: ReactNode; ticker?: ReactNode }) {
  const { data: s } = useQuery(settingsQuery);
  useEffect(() => {
    document.documentElement.style.setProperty("--card-ratio", ratioCss(s?.card_image_ratio));
  }, [s?.card_image_ratio]);
  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-2">Skip to content</a>
      <Header />
      {s?.is_live && s.live_stream_url && (
        <Link to="/live" className="block bg-brand text-brand-foreground">
          <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-2 px-4 py-2 text-sm font-bold">
            <span className="inline-flex shrink-0 items-center gap-1.5 uppercase"><span className="h-2 w-2 animate-pulse rounded-full bg-brand-foreground" /> Live now</span>
            <span className="truncate">{s.live_title}</span>
            <span className="ml-auto shrink-0 underline">Watch</span>
          </div>
        </Link>
      )}
      {ticker}
      <div className="mx-auto w-full max-w-7xl px-4 pt-5">
        <AdSlot slot="leaderboard" />
      </div>
      <main id="main" className="min-w-0 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
