import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, PlusCircle, Users, Settings, History, LogOut, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Newsroom Dashboard | Serbia 15 Online News" },
      { name: "description", content: "Serbia 15 Online News newsroom content management." },
      { property: "og:title", content: "Serbia 15 Online News Newsroom" },
      { property: "og:description", content: "Staff dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { session, roles, loading, isStaff, isAdmin, isEditor, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/dashboard", label: "Content", Icon: FileText, exact: true },
    { to: "/dashboard/editor", label: "New story", Icon: PlusCircle },
    ...(isAdmin
      ? [
          { to: "/dashboard/staff", label: "Staff", Icon: Users },
          { to: "/dashboard/settings", label: "Site settings", Icon: Settings },
          { to: "/dashboard/activity", label: "Activity log", Icon: History },
        ]
      : isEditor ? [{ to: "/dashboard/settings", label: "Live broadcast", Icon: Settings }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-muted/40 md:flex">
      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 p-4">
          <img src={logo.url} alt="" className="h-10 w-10 rounded-full bg-background" />
          <div className="leading-tight">
            <p className="font-display font-black">SERBIA 15 ONLINE NEWS</p>
            <p className="text-xs opacity-70">Newsroom</p>
          </div>
        </div>
        {isStaff && (
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
            {links.map(({ to, label, Icon, ...rest }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: "exact" in rest }}
                className="flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex gap-1 px-2 pb-3 md:absolute md:bottom-0 md:w-60 md:flex-col">
          <Link to="/" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-sidebar-accent"><Globe className="h-4 w-4" /> View website</Link>
          <button onClick={signOut} className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-sidebar-accent"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <p className="mb-4 text-xs text-muted-foreground">
          Signed in as {session?.user.email} {roles.length > 0 && <>· <span className="font-semibold capitalize">{roles.join(", ")}</span></>}
        </p>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : isStaff ? (
          <Outlet />
        ) : (
          <div className="max-w-lg rounded-sm border bg-card p-8">
            <h1 className="font-display text-2xl font-bold">Waiting for approval</h1>
            <p className="mt-2 text-muted-foreground">
              Your account is registered. An administrator must assign you a newsroom role (reporter, editor or admin) before you can manage content.
            </p>
            <button onClick={refreshRoles} className="mt-4 rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground">Check again</button>
          </div>
        )}
      </main>
    </div>
  );
}
