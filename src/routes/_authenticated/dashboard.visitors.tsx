import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/visitors")({
  head: () => ({ meta: [{ title: "Visitors | Serbia 15 Dashboard" }, { name: "robots", content: "noindex" }] }),
  component: VisitorsPage,
});

type Stats = {
  today_visitors: number; today_views: number; week_visitors: number; month_visitors: number;
  total_visitors: number; total_views: number; top_pages: { path: string; views: number }[];
};

function VisitorsPage() {
  const { isAdmin } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["visit-stats"],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("visit_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
  if (!isAdmin) return <p className="text-muted-foreground">Only admins can see visitor numbers.</p>;
  const cards = data ? [
    ["Today · Yau", data.today_visitors, `${data.today_views} page views`],
    ["Last 7 days", data.week_visitors, "unique visitors"],
    ["Last 30 days", data.month_visitors, "unique visitors"],
    ["All time", data.total_visitors, `${data.total_views} page views`],
  ] as const : [];
  return (
    <div>
      <h1 className="font-display text-3xl font-black text-navy">Visitors · Masu ziyara</h1>
      <p className="mt-1 text-sm text-muted-foreground">Real counts of people who opened the website. Counting started when this feature was added. Updates every minute.</p>
      {isLoading && <p className="mt-6">Loading…</p>}
      {error && <p className="mt-6 text-destructive">{(error as Error).message}</p>}
      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, n, sub]) => (
              <div key={label} className="rounded-sm border-t-4 border-brand bg-card p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-4xl font-black text-navy">{n.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-8 font-display text-xl font-black text-navy">Most visited pages (30 days)</h2>
          {data.top_pages.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No visits recorded yet.</p> : (
            <ol className="mt-3 divide-y rounded-sm border bg-card">
              {data.top_pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3 px-4 py-2 text-sm">
                  <a href={p.path} target="_blank" rel="noreferrer" className="truncate hover:underline">{p.path}</a>
                  <span className="font-bold">{p.views}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
