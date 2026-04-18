import { createFileRoute, Outlet, redirect, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatChatListTime, initials } from "@/lib/format";
import { MessageCircle, Plus, Search, LogOut, User as UserIcon, ArrowLeft, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FriendsPanel } from "@/components/FriendsPanel";
import { playMessageSound } from "@/lib/sound";

export const Route = createFileRoute("/chats")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: ChatsLayout,
});

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
};

type Profile = { id: string; name: string; avatar_url: string | null; status: string };

type ChatItem = {
  conversationId: string;
  other: Profile;
  lastMessage?: { content: string; created_at: string; sender_id: string };
  lastMessageAt: string;
};

function ChatsLayout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const [tab, setTab] = useState<"chats" | "friends">("chats");
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const activeConvRef = useRef<string | undefined>(undefined);
  activeConvRef.current = params.conversationId;
  const userIdRef = useRef<string | undefined>(undefined);
  userIdRef.current = user?.id;

  const loadChats = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (!convs) return;
    const otherIds = convs.map((c: ConversationRow) => (c.user_a === user.id ? c.user_b : c.user_a));
    const { data: profiles } = otherIds.length
      ? await supabase.from("profiles").select("id,name,avatar_url,status").in("id", otherIds)
      : { data: [] as Profile[] };
    const lastByConv = new Map<string, { content: string; created_at: string; sender_id: string }>();
    await Promise.all(
      convs.map(async (c: ConversationRow) => {
        const { data: m } = await supabase
          .from("messages")
          .select("content,created_at,sender_id")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (m) lastByConv.set(c.id, m as { content: string; created_at: string; sender_id: string });
      })
    );
    const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));
    setChats(
      convs.map((c: ConversationRow) => {
        const otherId = c.user_a === user.id ? c.user_b : c.user_a;
        return {
          conversationId: c.id,
          other: profileMap.get(otherId) ?? { id: otherId, name: "Unknown", avatar_url: null, status: "offline" },
          lastMessage: lastByConv.get(c.id),
          lastMessageAt: c.last_message_at,
        };
      })
    );
  };

  const loadUnread = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("conversation_id")
      .neq("sender_id", user.id)
      .neq("status", "read")
      .limit(1000);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((m: { conversation_id: string }) => {
      counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
    });
    setUnread(counts);
  };

  const loadPendingCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("status", "pending");
    setPendingRequests(count ?? 0);
  };

  useEffect(() => {
    loadChats();
    loadUnread();
    loadPendingCount();
    if (!user) return;
    const channel = supabase
      .channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadChats())
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as { id: string; conversation_id: string; sender_id: string; content: string };
          loadChats();
          if (m.sender_id === userIdRef.current) return;
          // RLS already filters server-side; double-check client-side that this convo is mine.
          const { data: isMine } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", m.conversation_id)
            .maybeSingle();
          if (!isMine) return;
          if (activeConvRef.current === m.conversation_id) return;
          setUnread((prev) => ({ ...prev, [m.conversation_id]: (prev[m.conversation_id] ?? 0) + 1 }));
          playMessageSound();
          const { data: sender } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", m.sender_id)
            .maybeSingle();
          toast(sender?.name ?? "New message", {
            description: m.content.length > 80 ? m.content.slice(0, 80) + "…" : m.content,
            action: {
              label: "Open",
              onClick: () => navigate({ to: "/chats/$conversationId", params: { conversationId: m.conversation_id } }),
            },
          });
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        loadUnread();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => loadChats())
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => {
        loadPendingCount();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => loadChats())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_blocks" }, () => loadChats())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Clear unread for the currently open conversation
  useEffect(() => {
    if (!params.conversationId) return;
    setUnread((prev) => {
      if (!prev[params.conversationId!]) return prev;
      const next = { ...prev };
      delete next[params.conversationId!];
      return next;
    });
  }, [params.conversationId]);

  const filtered = chats.filter((c) => c.other.name.toLowerCase().includes(search.toLowerCase()));
  const showSidebarOnMobile = !params.conversationId;
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="h-screen flex bg-background">
      <aside
        className={cn(
          "w-full md:w-[360px] md:border-r border-border flex flex-col bg-sidebar",
          showSidebarOnMobile ? "flex" : "hidden md:flex"
        )}
      >
        <header className="px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow shadow-primary/20">
              <MessageCircle className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">Pulse</span>
          </div>
          <div className="flex items-center gap-1">
            {tab === "chats" && (
              <NewChatDialog
                open={newOpen}
                onOpenChange={setNewOpen}
                onCreated={(id) => {
                  setNewOpen(false);
                  navigate({ to: "/chats/$conversationId", params: { conversationId: id } });
                }}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full">
                  <Avatar className="size-9">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(profile?.name ?? "U")}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile"><UserIcon className="size-4 mr-2" /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/auth" }); toast.success("Signed out"); }}>
                  <LogOut className="size-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Top tabs */}
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60">
            <TabBtn active={tab === "chats"} onClick={() => setTab("chats")} icon={<MessageCircle className="size-4" />} label="Chats" badge={totalUnread} />
            <TabBtn active={tab === "friends"} onClick={() => setTab("friends")} icon={<Users className="size-4" />} label="Friends" badge={pendingRequests} />
          </div>
        </div>

        {tab === "chats" ? (
          <>
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="pl-9 h-10 rounded-xl bg-muted/60 border-transparent focus-visible:bg-background" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto size-12 rounded-2xl bg-accent grid place-items-center mb-3">
                    <MessageCircle className="size-5 text-accent-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No conversations yet.<br />Add a friend, then tap + to start.</p>
                </div>
              )}
              {filtered.map((c) => {
                const u = unread[c.conversationId] ?? 0;
                return (
                  <Link
                    key={c.conversationId}
                    to="/chats/$conversationId"
                    params={{ conversationId: c.conversationId }}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-accent/60 transition-colors"
                    activeProps={{ className: "bg-accent" }}
                  >
                    <div className="relative">
                      <Avatar className="size-12">
                        <AvatarImage src={c.other.avatar_url ?? undefined} />
                        <AvatarFallback>{initials(c.other.name)}</AvatarFallback>
                      </Avatar>
                      {c.other.status === "online" && (
                        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-online ring-2 ring-sidebar" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate", u > 0 ? "font-semibold" : "font-medium")}>{c.other.name}</span>
                        <span className={cn("text-[11px] shrink-0", u > 0 ? "text-primary font-medium" : "text-muted-foreground")}>
                          {formatChatListTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm truncate", u > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {c.lastMessage?.content ?? "Say hi 👋"}
                        </p>
                        {u > 0 && (
                          <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center animate-scale-in">
                            {u > 99 ? "99+" : u}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <FriendsPanel />
        )}
      </aside>

      <main className={cn("flex-1 flex flex-col", showSidebarOnMobile ? "hidden md:flex" : "flex")}>
        {params.conversationId ? (
          <Outlet />
        ) : (
          <div className="flex-1 grid place-items-center bg-gradient-to-br from-background to-accent/30">
            <div className="text-center max-w-sm px-6">
              <div className="mx-auto size-16 rounded-3xl bg-primary/10 text-primary grid place-items-center mb-4">
                <MessageCircle className="size-7" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Your messages live here</h2>
              <p className="text-sm text-muted-foreground mt-1">Select a conversation or start a new one to begin.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
        active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{badge}</span>
      ) : null}
    </button>
  );
}

function NewChatDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const { data: fs } = await supabase
        .from("friendships")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const ids = (fs ?? []).map((f) => (f.user_a === user.id ? f.user_b : f.user_a));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,name,avatar_url,status").in("id", ids);
        setFriends((profs ?? []) as Profile[]);
      } else {
        setFriends([]);
      }
      setLoading(false);
    })();
    return () => { setQ(""); };
  }, [open, user]);

  const startChat = async (other: Profile) => {
    if (!user) return;
    const [a, b] = [user.id, other.id].sort();
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (existing) { onCreated(existing.id); return; }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_a: a, user_b: b })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    onCreated(data.id);
  };

  const filtered = friends.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="rounded-full"><Plus className="size-5" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your friends" className="pl-9 h-10 rounded-xl" />
        </div>
        <div className="max-h-72 overflow-y-auto -mx-2">
          {loading && <p className="text-sm text-muted-foreground px-4 py-3">Loading…</p>}
          {!loading && friends.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">
              You don't have any friends yet. Open the Friends tab to add some.
            </p>
          )}
          {!loading && friends.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-3">No friend matches "{q}".</p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => startChat(p)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-accent/60 text-left"
            >
              <Avatar className="size-10">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback>{initials(p.name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{p.status}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MobileBack() {
  const navigate = useNavigate();
  return (
    <Button size="icon" variant="ghost" className="md:hidden -ml-2" onClick={() => navigate({ to: "/chats" })}>
      <ArrowLeft className="size-5" />
    </Button>
  );
}
