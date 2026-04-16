import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { OpenClawProvider } from "@/lib/openclaw-context";
import { ChatProvider } from "@/lib/chat-context";
import { TeamProvider } from "@/lib/team-context";
import { GlobalChat } from "@/components/global-chat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "AI Agent Orchestration Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <OpenClawProvider>
          <ChatProvider>
            <TeamProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-auto">
                  <TopBar />
                  <main className="flex-1">{children}</main>
                </div>
              </div>
              <GlobalChat />
            </TeamProvider>
          </ChatProvider>
        </OpenClawProvider>
      </body>
    </html>
  );
}
