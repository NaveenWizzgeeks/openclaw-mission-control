"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  TEAM_AGENTS,
  MISSIONS,
  PIPELINE_STAGES,
  type TeamAgent,
  type Mission,
  type MissionPriority,
  type PipelineStage,
  type MissionLog,
  getNextStage,
} from "./team-store";

interface TeamContextData {
  agents: TeamAgent[];
  missions: Mission[];
  selectedMission: Mission | null;
  selectMission: (mission: Mission | null) => void;
  createMission: (title: string, description: string, priority: MissionPriority, tags: string[]) => void;
  advanceMission: (missionId: string) => void;
  reportBug: (missionId: string, message: string) => void;
  getAgentMissions: (agentId: string) => Mission[];
  getMissionProgress: (mission: Mission) => number;
}

const TeamContext = createContext<TeamContextData>({
  agents: [],
  missions: [],
  selectedMission: null,
  selectMission: () => {},
  createMission: () => {},
  advanceMission: () => {},
  reportBug: () => {},
  getAgentMissions: () => [],
  getMissionProgress: () => 0,
});

export function useTeam() {
  return useContext(TeamContext);
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<TeamAgent[]>(TEAM_AGENTS);
  const [missions, setMissions] = useState<Mission[]>(MISSIONS);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  const selectMission = useCallback((mission: Mission | null) => {
    setSelectedMission(mission);
  }, []);

  const createMission = useCallback(
    (title: string, description: string, priority: MissionPriority, tags: string[]) => {
      const now = new Date().toISOString();
      const newMission: Mission = {
        id: `mission-${Date.now()}`,
        title,
        description,
        priority,
        status: "queued",
        currentStage: "intake",
        currentAgentId: "jarvis",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        stageHistory: [
          { stage: "intake", agentId: "jarvis", enteredAt: now, exitedAt: null },
        ],
        logs: [
          {
            id: `log-${Date.now()}`,
            timestamp: now,
            agentId: "jarvis",
            stage: "intake",
            type: "info",
            message: `New mission received: "${title}". Priority: ${priority}. Queued for processing.`,
          },
        ],
        bugLoopCount: 0,
        tags,
      };

      setMissions((prev) => [newMission, ...prev]);
    },
    []
  );

  const advanceMission = useCallback((missionId: string) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== missionId) return m;

        const nextStage = getNextStage(m.currentStage);
        if (!nextStage) return m;

        const stageConfig = PIPELINE_STAGES.find((s) => s.id === nextStage);
        if (!stageConfig) return m;

        const now = new Date().toISOString();
        const updatedHistory = m.stageHistory.map((h) =>
          h.exitedAt === null ? { ...h, exitedAt: now } : h
        );

        const newLog: MissionLog = {
          id: `log-${Date.now()}`,
          timestamp: now,
          agentId: stageConfig.agentId,
          stage: nextStage,
          type: nextStage === "completed" ? "completion" : "handoff",
          message:
            nextStage === "completed"
              ? "Mission completed successfully. All stages passed."
              : `Task handed off to ${stageConfig.label} stage.`,
        };

        return {
          ...m,
          currentStage: nextStage,
          currentAgentId: stageConfig.agentId,
          updatedAt: now,
          status: nextStage === "completed" ? "completed" : m.status === "queued" ? "active" : m.status,
          completedAt: nextStage === "completed" ? now : null,
          stageHistory: [
            ...updatedHistory,
            { stage: nextStage, agentId: stageConfig.agentId, enteredAt: now, exitedAt: null },
          ],
          logs: [...m.logs, newLog],
        };
      })
    );
  }, []);

  const reportBug = useCallback((missionId: string, message: string) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== missionId) return m;

        const now = new Date().toISOString();
        const updatedHistory = m.stageHistory.map((h) =>
          h.exitedAt === null ? { ...h, exitedAt: now } : h
        );

        const bugLog: MissionLog = {
          id: `log-${Date.now()}-bug`,
          timestamp: now,
          agentId: "pulse",
          stage: "testing",
          type: "bug",
          message: `Bug reported: ${message}. Sending back to Forge for fix.`,
        };

        return {
          ...m,
          currentStage: "development" as PipelineStage,
          currentAgentId: "forge",
          updatedAt: now,
          bugLoopCount: m.bugLoopCount + 1,
          stageHistory: [
            ...updatedHistory,
            { stage: "development" as PipelineStage, agentId: "forge", enteredAt: now, exitedAt: null },
          ],
          logs: [...m.logs, bugLog],
        };
      })
    );
  }, []);

  const getAgentMissions = useCallback(
    (agentId: string) => {
      return missions.filter(
        (m) => m.currentAgentId === agentId && m.status === "active"
      );
    },
    [missions]
  );

  const getMissionProgress = useCallback((mission: Mission): number => {
    const totalStages = PIPELINE_STAGES.length;
    const currentConfig = PIPELINE_STAGES.find((s) => s.id === mission.currentStage);
    if (!currentConfig) return 0;
    return Math.round((currentConfig.order / (totalStages - 1)) * 100);
  }, []);

  return (
    <TeamContext.Provider
      value={{
        agents,
        missions,
        selectedMission,
        selectMission,
        createMission,
        advanceMission,
        reportBug,
        getAgentMissions,
        getMissionProgress,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
