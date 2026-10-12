import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/activity")({ component: Activity });

function Activity() {
  const { isAdmin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["activity"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  if (!isAdmin) return <p>Only administrators can view the activity log.</p>;
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-black text-navy">Activity log</h1>
      <div className="mt-6 overflow-x-auto rounded-sm border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-2">When</th><th className="p-2">Who</th><th className="p-2">Action</th><th className="p-2">Details</th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={4}>Loading…</td></tr>}
            {data?.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={4}>No activity recorded yet.</td></tr>}
            {data?.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="whitespace-nowrap p-2">{new Date(l.created_at).toLocaleString("en-GB")}</td>
                <td className="p-2">{l.user_email}</td>
                <td className="p-2 font-medium">{l.action} <span className="text-muted-foreground">{l.entity}</span></td>
                <td className="max-w-xs truncate p-2 text-muted-foreground">{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
