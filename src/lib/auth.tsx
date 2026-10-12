import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "editor" | "reporter";
type AuthState = {
  session: Session | null;
  roles: Role[];
  loading: boolean;
  isStaff: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  refreshRoles: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRoles(uid: string | undefined) {
    if (!uid) return setRoles([]);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadRoles(s?.user.id), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadRoles(data.session?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    roles,
    loading,
    isStaff: roles.length > 0,
    isEditor: roles.includes("admin") || roles.includes("editor"),
    isAdmin: roles.includes("admin"),
    refreshRoles: () => loadRoles(session?.user.id),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export async function logActivity(action: string, entity: string, entityId?: string | null, details?: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("activity_log").insert({
    user_id: data.user.id,
    user_email: data.user.email ?? "",
    action,
    entity,
    entity_id: entityId ?? null,
    details: details?.slice(0, 500) ?? null,
  });
}
