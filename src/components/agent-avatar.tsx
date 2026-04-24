"use client";

import { SQUAD } from "@/lib/team-store";
import { cn } from "@/lib/utils";

const SIZE_CLS = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export function AgentAvatar({
  agentId,
  size = "md",
}: {
  agentId: string;
  size?: "sm" | "md" | "lg";
}) {
  const agent = SQUAD.find((a) => a.id === agentId);
  const sz = SIZE_CLS[size];
  if (agentId === "user") {
    return (
      <div className={cn("rounded-md bg-primary text-white font-bold flex items-center justify-center shrink-0", sz)}>
        U
      </div>
    );
  }
  return (
    <div className={cn("rounded-md font-bold text-white flex items-center justify-center shrink-0", sz, agent?.color ?? "bg-muted")}>
      {agent?.avatar ?? agentId[0]?.toUpperCase()}
    </div>
  );
}
