import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCall } from "@/lib/calls";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2, MoreVertical } from "lucide-react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type CallRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};
type Profile = { id: string; name: string; avatar_url: string | null };
type Conv = { id: string; user_a: string; user_b: string };

type CallEntry = {
  id: string;
  peer: Profile;
  conversationId: string;
  mode: "audio" | "video";
  direction: "incoming" | "outgoing";
  outcome: "missed" | "rejected" | "ended";
  at: string;
};

function parseCallContent(content: string): { mode: "audio" | "video"; outcome: "missed" | "rejected" | "ended" } | null {
  // Matches strings produced by logCallEvent in calls.tsx
  const isVideo = /video call/i.test(content);
  const mode: "audio" | "video" = isVideo ? "video" : "audio";
  if (/Missed|No answer/i.test(content)) return { mode, outcome: "missed" };
  if (/Declined|declined/i.test(content)) return { mode, outcome: "rejected" };
  if (/Call ended/i.test(content)) return { mode, outcome: "ended" };
  return null;
}

function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function CallsTab() {
  const { user } = useAuth();
  const { startCall } = useCall();
  const [entries, setEntries] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id,user_a,user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const convList = (convs ?? []) as Conv[];
    if (!convList.length) { setEntries([]); setLoading(false); return; }
    const convIds = convList.map((c) => c.id);
    const otherIds = Array.from(new Set(convList.map((c) => (c.user_a === user.id ? c.user_b : c.user_a))));

    const [{ data: msgs }, { data: profs }] = await Promise.all([
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,content,created_at")
        .in("conversation_id", convIds)
        .or("content.ilike.📞%,content.ilike.📹%")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("profiles").select("id,name,avatar_url").in("id", otherIds),
    ]);
    const profMap = new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
    const convMap = new Map(convList.map((c) => [c.id, c]));
    const out: CallEntry[] = [];
    for (const m of (msgs ?? []) as CallRow[]) {
      const parsed = parseCallContent(m.content);
      if (!parsed) continue;
      const conv = convMap.get(m.conversation_id);
      if (!conv) continue;
      const peerId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const peer = profMap.get(peerId) ?? { id: peerId, name: "Unknown", avatar_url: null };
      out.push({
        id: m.id,
        peer,
        conversationId: m.conversation_id,
        mode: parsed.mode,
        outcome: parsed.outcome,
        direction: m.sender_id === user.id ? "outgoing" : "incoming",
        at: m.created_at,
      });
    }
    setEntries(out);
    setLoading(false);
  };

  const deleteOne = async (entry: CallEntry) => {
    // Optimistic
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", entry.id)
      .eq("sender_id", user?.id ?? "");
    if (error) {
      toast.error(error.message);
      void load();
      return;
    }
    toast.success("Call log deleted");
  };

  const clearAll = async () => {
    if (!user) return;
    setClearing(true);
    // Only delete OUR OWN call log messages — RLS only allows sender to delete.
    const myCallIds = entries.filter((e) => e.direction === "outgoing").map((e) => e.id);
    if (myCallIds.length === 0) {
      setClearing(false);
      setConfirmClear(false);
      toast.info("You can only clear call logs you started.");
      return;
    }
    const snapshot = entries;
    setEntries((prev) => prev.filter((e) => !myCallIds.includes(e.id)));
    const { error } = await supabase.from("messages").delete().in("id", myCallIds);
    setClearing(false);
    setConfirmClear(false);
    if (error) {
      setEntries(snapshot);
      toast.error(error.message);
      return;
    }
    toast.success(`Cleared ${myCallIds.length} call log${myCallIds.length === 1 ? "" : "s"}`);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`calls-tab:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const old = payload.old as { id?: string };
        if (!old?.id) return;
        setEntries((prev) => prev.filter((e) => e.id !== old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 sticky top-0 bg-sidebar/80 backdrop-blur z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent calls</span>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="size-3.5 mr-1" /> Clear all
          </Button>
        )}
      </div>
      {loading && <div className="px-6 py-8 text-sm text-muted-foreground text-center">Loading…</div>}
      {!loading && entries.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          No call history yet.<br />Start a voice or video call from any chat.
        </div>
      )}
      {entries.map((e) => {
        const isMissed = e.outcome === "missed" && e.direction === "incoming";
        const Icon = isMissed ? PhoneMissed : e.direction === "outgoing" ? PhoneOutgoing : PhoneIncoming;
        const canDelete = e.direction === "outgoing"; // Only sender can delete via RLS
        return (
          <div key={e.id} className="mx-2 px-3 py-3 rounded-2xl flex items-center gap-3 hover:bg-accent/60">
            <Avatar className="size-12">
              <AvatarImage src={e.peer.avatar_url ?? undefined} />
              <AvatarFallback>{initials(e.peer.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className={cn("font-medium truncate", isMissed && "text-destructive")}>{e.peer.name}</div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Icon className={cn("size-3.5", isMissed ? "text-destructive" : "text-muted-foreground")} />
                <span className="capitalize">{e.outcome === "ended" ? e.direction : e.outcome}</span>
                <span>•</span>
                <span>{shortTime(e.at)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => startCall({ id: e.peer.id, name: e.peer.name, avatar_url: e.peer.avatar_url }, e.mode)}
              className="size-9 rounded-full grid place-items-center text-primary hover:bg-primary/10"
              aria-label={`Call ${e.peer.name}`}
            >
              {e.mode === "video" ? <Video className="size-4" /> : <Phone className="size-4" />}
            </button>
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="size-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
                    aria-label="Call options"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => deleteOne(e)} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4 mr-2" /> Delete log
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all your call logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes call log entries you started. Logs from incoming calls will remain.
              This won't delete any chat messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll} disabled={clearing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearing ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}