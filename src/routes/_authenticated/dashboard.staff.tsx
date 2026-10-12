import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useAuth, type Role } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/staff")({ component: Staff });

const ROLES: { r: Role; d: string }[] = [
  { r: "reporter", d: "Write & submit stories" },
  { r: "editor", d: "Publish, schedule, feature" },
  { r: "admin", d: "Full control incl. staff & settings" },
];

function Staff() {
  const { isAdmin, session } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["staff"],
    enabled: isAdmin,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (p.error) throw p.error;
      return (p.data ?? []).map((u) => ({ ...u, roles: (r.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.role as Role) }));
    },
  });

  if (!isAdmin) return <p>Only administrators can manage staff.</p>;

  async function toggle(uid: string, email: string, role: Role, has: boolean) {
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    await logActivity(has ? "remove_role" : "grant_role", "user", uid, `${role} → ${email}`);
    qc.invalidateQueries({ queryKey: ["staff"] });
    toast.success("Permissions updated");
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-black text-navy">Staff & permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">New staff register on the Staff login page, confirm their email, then appear here. Assign a role to give them access.</p>
      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {data?.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 rounded-sm border bg-card p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{u.full_name || "(no name)"} {u.id === session?.user.id && <span className="text-xs text-muted-foreground">(you)</span>}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              {u.roles.length === 0 && <p className="text-xs font-semibold text-brand">Awaiting approval</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              {ROLES.map(({ r, d }) => {
                const has = u.roles.includes(r);
                const self = u.id === session?.user.id && r === "admin";
                return (
                  <Button key={r} size="sm" variant={has ? "default" : "outline"} title={d} disabled={self} onClick={() => toggle(u.id, u.email, r, has)} className="capitalize">
                    {has ? "✓ " : "+ "}{r}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
