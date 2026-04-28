import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { OpenClawProvider } from "@/lib/openclaw-context";
import { ChatProvider } from "@/lib/chat-context";
import { TeamProvider } from "@/lib/team-context";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { MissionProvider } from "@/lib/mission-context";
import { GlobalChat } from "@/components/global-chat";
import { HeartbeatEngine } from "@/components/heartbeat-engine";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "AI Agent Orchestration — Sequential Multi-Agent System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased font-mono">
        <OpenClawProvider>
          <ChatProvider>
            <TeamProvider>
              <WorkspaceProvider>
                <MissionProvider>
                  <div className="flex min-h-screen">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-auto">
                      <TopBar />
                      <main className="flex-1">{children}</main>
                    </div>
                  </div>
                  <GlobalChat />
                  <HeartbeatEngine />
                </MissionProvider>
              </WorkspaceProvider>
            </TeamProvider>
          </ChatProvider>
        </OpenClawProvider>
      </body>
    </html>
  );
}
