import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatTime, initials } from "@/lib/format";
import { Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileBack } from "./chats";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$groupId")({
  component: GroupChatView,
});

type Message = {
  id: string;
  group_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  content: string;
  status: string;
  created_at: string;
};

type Group = { id: string; name: string; avatar_url: string | null };
type Member = { id: string; name: string; avatar_url: string | null };

function mergeMessages(current: Message[], incoming: Message[]) {
  const next = [...current];

  for (const message of incoming) {
    const existingIndex = next.findIndex((item) => item.id === message.id);
    if (existingIndex !== -1) {
      next[existingIndex] = message;
      continue;
    }

    const optimisticIndex = next.findIndex(
      (item) => item.id.startsWith("temp-") && item.sender_id === message.sender_id && item.content === message.content,
    );

    if (optimisticIndex !== -1) {
      next[optimisticIndex] = message;
      continue;
    }

    next.push(message);
  }

  return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function GroupChatView() {
  const { groupId } = useParams({ from: "/groups/$groupId" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelKey = useId();
  const latestMessageAtRef = useRef<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [realtimeHealthy, setRealtimeHealthy] = useState(false);

  // Load group + members + messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setInitialLoaded(false);
    (async () => {
      const [{ data: g }, { data: ms }, { data: mems }] = await Promise.all([
        supabase.from("groups").select("id,name,avatar_url").eq("id", groupId).maybeSingle(),
        supabase.from("messages").select("*").eq("group_id", groupId).order("created_at", { ascending: true }).limit(500),
        supabase.from("group_members").select("user_id").eq("group_id", groupId),
      ]);
      if (cancelled) return;
      if (!g) { toast.error("Group not found"); navigate({ to: "/chats" }); return; }
      setGroup(g as Group);
      setMessages((ms ?? []) as Message[]);
      setInitialLoaded(true);
      const memberIds = (mems ?? []).map((m) => m.user_id);
      if (memberIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,name,avatar_url")
          .in("id", memberIds);
        if (!cancelled) setMembers((profs ?? []) as Member[]);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, user?.id, navigate]);

  // Realtime
  useEffect(() => {
    latestMessageAtRef.current = messages.length ? messages[messages.length - 1].created_at : null;
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`group:${groupId}:${user.id}:${channelKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => mergeMessages(prev, [m]));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeHealthy(true);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeHealthy(false);
        }
      });
    return () => {
      setRealtimeHealthy(false);
      supabase.removeChannel(channel);
    };
  }, [groupId, user?.id, channelKey]);

  useEffect(() => {
    if (!initialLoaded || realtimeHealthy) return;

    let cancelled = false;

    const syncRecentMessages = async () => {
      let query = supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (latestMessageAtRef.current) {
        query = query.gt("created_at", latestMessageAtRef.current);
      }

      const { data, error } = await query;
      if (cancelled || error || !data?.length) return;
      setMessages((prev) => mergeMessages(prev, data as Message[]));
    };

    void syncRecentMessages();
    const intervalId = window.setInterval(() => {
      void syncRecentMessages();
    }, 750);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [groupId, initialLoaded, realtimeHealthy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !user || sending) return;
    setSending(true);
    setDraft("");
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      group_id: groupId,
      conversation_id: null,
      sender_id: user.id,
      content,
      status: "sent",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({ group_id: groupId, sender_id: user.id, content })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content);
    } else if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => (m.id === tempId ? (data as Message) : m));
      });
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 border-b border-border px-3 md:px-5 flex items-center gap-3 bg-card/50 backdrop-blur">
        <MobileBack />
        <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
          <Users className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{group?.name ?? "Group"}</div>
          <div className="text-xs text-muted-foreground truncate">{members.length} member{members.length === 1 ? "" : "s"}</div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-full">Members</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{group?.name} · {members.length} members</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/40">
                  <Avatar className="size-9">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="font-medium">{m.name}{m.id === user?.id && <span className="text-muted-foreground font-normal"> · you</span>}</div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-2 bg-gradient-to-b from-background to-accent/20">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">No messages yet — start the conversation!</div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prev = messages[i - 1];
          const groupedWithPrev = prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
          const sender = memberMap.get(m.sender_id);
          return (
            <div key={m.id} className={cn("flex animate-fade-in", mine ? "justify-end" : "justify-start", groupedWithPrev ? "mt-0.5" : "mt-2")}>
              <div className={cn("max-w-[78%] md:max-w-[60%] px-3.5 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                mine ? "bg-bubble-out text-bubble-out-foreground rounded-br-md" : "bg-bubble-in text-bubble-in-foreground rounded-bl-md")}>
                {!mine && !groupedWithPrev && (
                  <div className="text-xs font-semibold text-primary mb-0.5">{sender?.name ?? "Member"}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="p-3 md:p-4 border-t border-border bg-card/50 backdrop-blur flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          className="h-11 rounded-2xl bg-muted/60 border-transparent focus-visible:bg-background"
          autoComplete="off"
        />
        <Button type="submit" size="icon" className="size-11 rounded-2xl shrink-0" disabled={!draft.trim() || sending}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
