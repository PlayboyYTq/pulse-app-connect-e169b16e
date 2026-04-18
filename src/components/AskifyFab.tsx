import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AskifyFab() {
  return (
    <Link
      to="/askify"
      aria-label="Open Askify AI"
      className="group fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 text-white shadow-lg shadow-violet-500/40 transition-transform hover:scale-110 active:scale-95"
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-violet-500/40" />
      <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 blur-xl opacity-60 group-hover:opacity-90 transition-opacity" />
      <Sparkles className="h-6 w-6 drop-shadow" />
    </Link>
  );
}
