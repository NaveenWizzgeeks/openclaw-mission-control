"use client";

import Link from "next/link";
import { NotificationPanel } from "./notification-panel";
import { ConnectionStatus } from "./connection-status";
import { Search, MessageCircle } from "lucide-react";

export function TopBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground w-full">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="text"
            placeholder="Search agents, tasks, projects..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground/50"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border border-border text-[10px] text-muted-foreground/60 font-mono">
            /
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/chat"
          className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border/50"
          title="Chat with Jarvis"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Chat with Jarvis</span>
        </Link>
        <ConnectionStatus />
        <NotificationPanel />
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          N
        </div>
      </div>
    </div>
  );
}
