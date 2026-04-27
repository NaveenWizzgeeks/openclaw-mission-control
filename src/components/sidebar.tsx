"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Bot, KanbanSquare, Activity, Settings, Zap,
  ChevronLeft, ChevronRight, DollarSign, MessageSquare, Plus,
  Users, StickyNote, Plug, Sparkles, Brain, Globe,
  ChevronDown, ChevronUp, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useOpenClaw } from "@/lib/openclaw-context";
import { useChatContext } from "@/lib/chat-context";
import { useWorkspace } from "@/lib/workspace-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [wsExpanded, setWsExpanded] = useState(true);
  const { sessions, connected } = useOpenClaw();
  const { openChat } = useChatContext();
  const { workspaces, activeWorkspace, selectWorkspace } = useWorkspace();

  const recentSessions = sessions.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
  const activeSessions = sessions.filter((s) => s.status === "running");

  const navItems = [
    { href: "/",        label: "Dashboard",    icon: LayoutDashboard },
    { href: "/team",    label: "Squad HQ",     icon: Users },
    { href: "/kanban",  label: "Board",        icon: KanbanSquare },
    { href: "/agents",  label: "Agents",       icon: Bot },
    { href: "/memory",  label: "Memory",       icon: Brain },
  ];

  const insightItems = [
    { href: "/activity", label: "Activity", icon: Activity },
    { href: "/costs",    label: "Costs",    icon: DollarSign },
  ];

  const toolItems = [
    { href: "/providers", label: "Providers", icon: Plug },
    { href: "/skills",    label: "Skills",    icon: Sparkles },
    { href: "/notes",     label: "Notes",     icon: StickyNote },
  ];

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link href={href} title={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
          isActive ? "bg-[#58a6ff]/10 text-[#58a6ff]" : "text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]",
          collapsed && "justify-center px-2"
        )}>
        <Icon className="h-[15px] w-[15px] shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  }

  return (
    <aside className={cn(
      "flex flex-col border-r border-[#30363d] bg-[#0d1117] transition-all duration-300 h-screen sticky top-0",
      collapsed ? "w-[60px]" : "w-[230px]"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 px-4 h-14 border-b border-[#30363d] shrink-0", collapsed && "justify-center px-2")}>
        <div className="h-7 w-7 rounded-lg bg-[#58a6ff]/15 border border-[#58a6ff]/20 flex items-center justify-center shrink-0">
          <Zap className="h-3.5 w-3.5 text-[#58a6ff]" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-[13px] text-[#e6edf3] leading-none">Mission Control</p>
            <p className="text-[10px] text-[#8b949e] mt-0.5 flex items-center gap-1">
              OpenClaw
              <span className={cn("h-1.5 w-1.5 rounded-full inline-block", connected ? "bg-[#3fb950]" : "bg-[#f85149]")} />
            </p>
          </div>
        )}
      </div>

      {/* Chat with Jarvis */}
      <div className={cn("px-2 pt-3 pb-2 shrink-0")}>
        <Link href="/chat" title={collapsed ? "Chat with Jarvis" : undefined}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg text-[11px] font-semibold transition-all",
            pathname === "/chat"
              ? "bg-[#58a6ff]/20 border border-[#58a6ff]/40 text-[#58a6ff]"
              : "bg-[#58a6ff]/10 border border-[#58a6ff]/20 text-[#58a6ff] hover:bg-[#58a6ff]/20",
            collapsed ? "justify-center p-2" : "px-3 py-1.5"
          )}>
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && "Chat with Jarvis"}
        </Link>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3 min-h-0">

        {/* Workspaces */}
        {!collapsed && workspaces.length > 0 && (
          <div>
            <button onClick={() => setWsExpanded((v) => !v)}
              className="flex items-center justify-between w-full px-3 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">Workspaces</p>
              {wsExpanded ? <ChevronUp className="h-3 w-3 text-[#484f58]" /> : <ChevronDown className="h-3 w-3 text-[#484f58]" />}
            </button>
            {wsExpanded && (
              <div className="space-y-0.5">
                {workspaces.map((ws) => {
                  const isActive = pathname.startsWith(`/workspace/${ws.id}`) || activeWorkspace?.id === ws.id;
                  return (
                    <button key={ws.id}
                      onClick={() => { selectWorkspace(ws.id); router.push(`/workspace/${ws.id}`); }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors text-left",
                        isActive ? "bg-[#58a6ff]/10 text-[#58a6ff]" : "text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]"
                      )}>
                      <span>{ws.icon}</span>
                      <span className="truncate">{ws.name}</span>
                    </button>
                  );
                })}
                <button onClick={() => router.push("/")}
                  className="flex items-center gap-2 w-full px-3 py-1 rounded-lg text-[11px] text-[#484f58] hover:text-[#8b949e] transition-colors">
                  <Plus className="h-3 w-3" />New workspace
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main nav */}
        <div>
          {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58] px-3 mb-1">Navigate</p>}
          <div className="space-y-0.5">{navItems.map((i) => <NavLink key={i.href} {...i} />)}</div>
        </div>

        {/* Insights */}
        <div>
          {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58] px-3 mb-1">Insights</p>}
          {collapsed && <div className="h-px bg-[#21262d] mx-2 mb-2" />}
          <div className="space-y-0.5">{insightItems.map((i) => <NavLink key={i.href} {...i} />)}</div>
        </div>

        {/* Tools */}
        <div>
          {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58] px-3 mb-1">Tools</p>}
          {collapsed && <div className="h-px bg-[#21262d] mx-2 mb-2" />}
          <div className="space-y-0.5">{toolItems.map((i) => <NavLink key={i.href} {...i} />)}</div>
        </div>

        {/* Sessions */}
        {!collapsed && (
          <div>
            <button onClick={() => setChatExpanded((v) => !v)}
              className="flex items-center justify-between w-full px-3 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">
                Chats {activeSessions.length > 0 && <span className="text-[#3fb950] normal-case">· {activeSessions.length}</span>}
              </p>
              {chatExpanded ? <ChevronUp className="h-3 w-3 text-[#484f58]" /> : <ChevronDown className="h-3 w-3 text-[#484f58]" />}
            </button>
            {chatExpanded && (
              <div className="space-y-0.5">
                {recentSessions.length === 0 ? (
                  <p className="text-[11px] text-[#484f58] px-3 py-1">No sessions</p>
                ) : recentSessions.map((s) => (
                  <button key={s.key} onClick={() => openChat(s)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[12px] text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3] transition-colors text-left">
                    <div className="relative shrink-0">
                      <MessageSquare className="h-[14px] w-[14px]" />
                      {s.status === "running" && <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#3fb950]" />}
                    </div>
                    <span className="truncate">{s.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {collapsed && (
          <>
            <div className="h-px bg-[#21262d] mx-2 mb-2" />
            <Link href="/chat" title="Chat with Jarvis"
              className="flex items-center justify-center w-full py-1.5 rounded-lg text-[#8b949e] hover:bg-[#161b22] relative">
              <MessageCircle className="h-[15px] w-[15px]" />
              {activeSessions.length > 0 && (
                <span className="absolute -top-0.5 right-2 h-3.5 w-3.5 rounded-full bg-[#3fb950] text-[9px] font-bold text-[#0d1117] flex items-center justify-center">
                  {activeSessions.length}
                </span>
              )}
            </Link>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 border-t border-[#30363d] p-2 space-y-0.5">
        <NavLink href="/settings" label="Settings" icon={Settings} />
        <button onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-[#484f58] hover:bg-[#161b22] hover:text-[#8b949e] transition-colors">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
    </aside>
  );
}

void Globe;
