import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  last_seen: string;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    const syncSession = (nextSession: Session | null) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      syncSession(s);
    });

    void supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Online presence
  useEffect(() => {
    if (!session?.user) return;
    const userId = session.user.id;
    const setOnline = () =>
      supabase.from("profiles").update({ status: "online", last_seen: new Date().toISOString() }).eq("id", userId);
    const setOffline = () =>
      supabase.from("profiles").update({ status: "offline", last_seen: new Date().toISOString() }).eq("id", userId);
    setOnline();
    const interval = setInterval(setOnline, 30000);
    const onHide = () => document.visibilityState === "hidden" && setOffline();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", setOffline);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", setOffline);
      setOffline();
    };
  }, [session?.user?.id]);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut: async () => {
          try {
            if (session?.user) {
              await supabase.from("profiles").update({ status: "offline", last_seen: new Date().toISOString() }).eq("id", session.user.id);
            }
          } catch {
            // best-effort presence update
          } finally {
            await supabase.auth.signOut();
          }
        },
        refreshProfile: async () => session?.user && loadProfile(session.user.id),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
