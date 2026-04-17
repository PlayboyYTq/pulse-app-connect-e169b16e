import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatTime, initials } from "@/lib/format";
import { Send, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileBack } from "./chats";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      // Mark incoming as delivered
      const undelivered = (msgs ?? []).filter((m) => m.sender_id !== user.id && m.status === "sent");
      if (undelivered.length) {
        await supabase.from("messages").update({ status: "delivered" }).in("id", undelivered.map((m) => m.id));
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, user?.id]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) {
            await supabase.from("messages").update({ status: "delivered" }).eq("id", m.id);
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id, other?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !user || sending) return;
    setSending(true);
    setDraft("");
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
              <div className="text-xs text-muted-foreground">
                {other.status === "online" ? "Online" : `Last seen ${formatTime(other.last_seen)}`}
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
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start", groupedWithPrev ? "mt-0.5" : "mt-2")}>
              <div
                className={cn(
                  "max-w-[78%] md:max-w-[60%] px-3.5 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                  mine ? "bg-bubble-out text-bubble-out-foreground rounded-br-md" : "bg-bubble-in text-bubble-in-foreground rounded-bl-md"
                )}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className={cn("flex items-center gap-1 mt-1 text-[10px]", mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground")}>
                  <span>{formatTime(m.created_at)}</span>
                  {mine && (m.status === "read" || m.status === "delivered" ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />)}
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
