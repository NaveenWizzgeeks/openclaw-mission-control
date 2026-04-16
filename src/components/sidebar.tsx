"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  KanbanSquare,
  CalendarDays,
  Activity,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  GitBranch,
  DollarSign,
  MessageSquare,
  Plus,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useOpenClaw } from "@/lib/openclaw-context";
import { useChatContext } from "@/lib/chat-context";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/projects", label: "Projects", icon: FolderOpen },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/team", label: "Team", icon: Users },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/kanban", label: "Kanban", icon: KanbanSquare },
      { href: "/workflows", label: "Workflows", icon: GitBranch },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/costs", label: "Costs", icon: DollarSign },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const { sessions, connected } = useOpenClaw();
  const { openChat, openNewChat } = useChatContext();

  const recentSessions = sessions
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 8);

  const activeSessions = sessions.filter((s) => s.status === "running");

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 h-14 border-b border-border shrink-0",
          collapsed && "justify-center px-2"
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          <Zap className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight">Mission Control</span>
            <span className="text-[10px] text-muted-foreground leading-none">
              OpenClaw
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full ml-1.5 relative -top-px",
                  connected ? "bg-emerald-500" : "bg-red-400"
                )}
              />
            </span>
          </div>
        )}
      </div>

      {/* New Chat Button */}
      <div className={cn("px-2 pt-3 pb-1 shrink-0", collapsed && "px-2")}>
        <button
          onClick={openNewChat}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg text-sm font-medium transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "shadow-sm shadow-primary/20",
            collapsed ? "justify-center p-2.5" : "px-3 py-2"
          )}
          title={collapsed ? "New Chat" : undefined}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-3 overflow-y-auto min-h-0">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && !collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">
                {section.label}
              </p>
            )}
            {collapsed && sIdx > 0 && (
              <div className="h-px bg-border/50 mx-2 mb-2" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Chat Sessions Section */}
        {!collapsed && (
          <div>
            <button
              onClick={() => setChatExpanded(!chatExpanded)}
              className="flex items-center justify-between w-full px-3 mb-1 group"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Chats
                {activeSessions.length > 0 && (
                  <span className="ml-1.5 text-emerald-400 normal-case">
                    {activeSessions.length} active
                  </span>
                )}
              </p>
              {chatExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              )}
            </button>
            {chatExpanded && (
              <div className="space-y-0.5">
                {recentSessions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/50 px-3 py-2">
                    No sessions yet
                  </p>
                ) : (
                  recentSessions.map((session) => (
                    <button
                      key={session.key}
                      onClick={() => openChat(session)}
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group text-left"
                      title={`${session.key} — ${session.model}`}
                    >
                      <div className="relative shrink-0">
                        <MessageSquare className="h-[15px] w-[15px]" />
                        {session.status === "running" && (
                          <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-card" />
                        )}
                      </div>
                      <span className="truncate flex-1 min-w-0">
                        {session.key}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {((session.totalTokens || 0) / 1000).toFixed(0)}K
                      </span>
                    </button>
                  ))
                )}
                {sessions.length > 8 && (
                  <Link
                    href="/agents"
                    className="flex items-center gap-2 px-3 py-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    View all {sessions.length} sessions
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed: show chat icon with badge */}
        {collapsed && (
          <>
            <div className="h-px bg-border/50 mx-2 mb-2" />
            <button
              onClick={openNewChat}
              title="Chats"
              className={cn(
                "flex items-center justify-center px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative mx-auto w-full"
              )}
            >
              <MessageSquare className="h-[17px] w-[17px]" />
              {activeSessions.length > 0 && (
                <span className="absolute -top-0.5 right-2 h-3.5 w-3.5 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {activeSessions.length}
                </span>
              )}
            </button>
          </>
        )}
      </nav>

      {/* Bottom: Settings + Collapse */}
      <div className="shrink-0 border-t border-border p-2 space-y-0.5">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
            pathname === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <Settings className="h-[17px] w-[17px] shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
