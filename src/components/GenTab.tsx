import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clipboard, Loader2, RefreshCw, Send, Sparkles, Wand2 } from "lucide-react";

const PROMPT_SUGGESTIONS = [
  "Write a professional message to welcome a new Circle user.",
  "Create a short birthday wish I can send in chat.",
  "Rewrite this message in a clear and friendly tone: ",
];

export function GenTab({ visible }: { visible: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || loading) return;

    setLoading(true);
    setError("");
    setResult("");

    try {
      const response = await fetch("/api/askify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: cleanPrompt }] }),
      });
      const data = (await response.json()) as { content?: string; error?: string };
      if (!response.ok || !data.content) throw new Error(data.error || "Generator failed");
      setResult(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generator failed");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col bg-background overflow-y-auto"
      style={{ display: visible ? "flex" : "none" }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <Sparkles className="size-4 text-primary" />
        <div className="text-sm font-semibold">Circle Gen</div>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-8 rounded-xl gap-1.5 text-xs"
          onClick={() => {
            setPrompt("");
            setResult("");
            setError("");
          }}
        >
          <RefreshCw className="size-3.5" />
          Reset
        </Button>
      </div>

      <div className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="mx-auto size-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--color-primary)_70%,transparent)] mb-5">
            <Wand2 className="size-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate in Circle</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Create messages, replies, captions, and ideas without leaving the app.
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void generate();
            }}
            placeholder="Ask Circle Gen to write, rewrite, summarize, or create something..."
            className="min-h-36 resize-none rounded-2xl bg-card/70 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                {suggestion.length > 46 ? `${suggestion.slice(0, 43)}...` : suggestion}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={generate} disabled={!prompt.trim() || loading} className="w-full h-12 rounded-2xl gap-2 text-sm font-semibold">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {loading ? "Generating..." : "Generate"}
        </Button>

        {(result || error) && (
          <div className="mt-5 rounded-2xl border border-border/70 bg-card/70 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-primary" />
              <div className="text-sm font-semibold">Result</div>
              {result && (
                <Button size="sm" variant="ghost" className="ml-auto h-8 rounded-xl gap-1.5 text-xs" onClick={copyResult}>
                  <Clipboard className="size-3.5" />
                  Copy
                </Button>
              )}
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{result}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
