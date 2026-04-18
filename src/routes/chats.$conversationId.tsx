import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatTime, initials } from "@/lib/format";
import { Send, Check, CheckCheck, MoreVertical, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileBack } from "./chats";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/chats/$conversationId")({
  component: ChatView,
});

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  status: "sent" | "delivered" | "read";
  created_at: string;
};

type Profile = { id: string; name: string; avatar_url: string | null; status: string; last_seen: string };

function ChatView() {
  const { conversationId } = useParams({ from: "/chats/$conversationId" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const otherTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blockUser = async () => {
    if (!user || !other) return;
    setBlocking(true);
    const { error } = await supabase
      .from("user_blocks")
      .insert({ blocker_id: user.id, blocked_id: other.id });
    setBlocking(false);
    if (error) return toast.error(error.message);
    toast.success(`${other.name} has been blocked`);
    setBlockOpen(false);
    navigate({ to: "/chats" });
  };

  // Load conversation + other user + messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user_a,user_b")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || cancelled) return;
      const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const [{ data: prof }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("id,name,avatar_url,status,last_seen").eq("id", otherId).maybeSingle(),
        supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(500),
      ]);
      if (cancelled) return;
      setOther(prof as Profile);
      setMessages((msgs ?? []) as Message[]);
      // Mark all incoming as read (covers "sent" + "delivered")
      const unread = (msgs ?? []).filter((m) => m.sender_id !== user.id && m.status !== "read");
      if (unread.length) {
        await supabase
          .from("messages")
          .update({ status: "read" })
          .in("id", unread.map((m) => m.id));
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, user?.id]);

  // Realtime: postgres_changes + typing broadcast
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conv:${conversationId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) {
            // Chat is open → mark as read immediately
            await supabase.from("messages").update({ status: "read" }).eq("id", m.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${other?.id ?? "00000000-0000-0000-0000-000000000000"}` },
        (payload) => setOther(payload.new as Profile)
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return;
        setOtherTyping(true);
        if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
        otherTypingTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return;
        setOtherTyping(false);
        if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, user?.id, other?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, otherTyping]);

  const broadcastTyping = (event: "typing" | "stop_typing") => {
    const ch = channelRef.current;
    if (!ch || !user) return;
    ch.send({ type: "broadcast", event, payload: { userId: user.id } }).catch(() => {});
  };

  const onDraftChange = (v: string) => {
    setDraft(v);
    if (!user) return;
    if (v.trim().length === 0) {
      broadcastTyping("stop_typing");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      lastTypingSentRef.current = 0;
      return;
    }
    const now = Date.now();
    // Throttle typing broadcast to at most every 1.5s
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      broadcastTyping("typing");
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping("stop_typing");
      lastTypingSentRef.current = 0;
    }, 2000);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !user || sending) return;
    setSending(true);
    setDraft("");
    broadcastTyping("stop_typing");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingSentRef.current = 0;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });
    if (error) {
      toast.error(error.message);
      setDraft(content);
    }
    setSending(false);
  };

  const subline = useMemo(() => {
    if (otherTyping) return "typing…";
    if (!other) return "";
    return other.status === "online" ? "Online" : `Last seen ${formatTime(other.last_seen)}`;
  }, [otherTyping, other]);

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 border-b border-border px-3 md:px-5 flex items-center gap-3 bg-card/50 backdrop-blur">
        <MobileBack />
        {other && (
          <>
            <div className="relative">
              <Avatar className="size-10">
                <AvatarImage src={other.avatar_url ?? undefined} />
                <AvatarFallback>{initials(other.name)}</AvatarFallback>
              </Avatar>
              {other.status === "online" && (
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-online ring-2 ring-card" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{other.name}</div>
              <div className={cn("text-xs transition-colors", otherTyping ? "text-primary font-medium" : "text-muted-foreground")}>
                {otherTyping ? (
                  <span className="inline-flex items-center gap-1">
                    typing
                    <span className="inline-flex gap-0.5">
                      <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="size-1 rounded-full bg-primary animate-bounce" />
                    </span>
                  </span>
                ) : (
                  subline
                )}
              </div>
            </div>
          </>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-2 bg-gradient-to-b from-background to-accent/20">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">No messages yet — say hi!</div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prev = messages[i - 1];
          const groupedWithPrev = prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
          return (
            <div key={m.id} className={cn("flex animate-fade-in", mine ? "justify-end" : "justify-start", groupedWithPrev ? "mt-0.5" : "mt-2")}>
              <div
                className={cn(
                  "max-w-[78%] md:max-w-[60%] px-3.5 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                  mine ? "bg-bubble-out text-bubble-out-foreground rounded-br-md" : "bg-bubble-in text-bubble-in-foreground rounded-bl-md"
                )}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className={cn("flex items-center gap-1 mt-1 text-[10px]", mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground")}>
                  <span>{formatTime(m.created_at)}</span>
                  {mine && (
                    m.status === "read" ? (
                      <CheckCheck className="size-3.5 text-read transition-colors" />
                    ) : m.status === "delivered" ? (
                      <CheckCheck className="size-3.5 transition-colors" />
                    ) : (
                      <Check className="size-3.5 transition-colors" />
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start mt-2 animate-fade-in">
            <div className="bg-bubble-in text-bubble-in-foreground rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm">
              <span className="inline-flex gap-1 items-center">
                <span className="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="p-3 md:p-4 border-t border-border bg-card/50 backdrop-blur flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
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
