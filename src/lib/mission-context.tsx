"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Mission } from "./mission-types";

interface MissionContextData {
  missions: Mission[];
  setMissions: (missions: Mission[]) => void;
  createMission: (data: { title: string; description: string; workspaceId: string }) => Promise<Mission>;
  submitAnswer: (missionId: string, answer: string) => Promise<Mission>;
  startExecution: (missionId: string) => Promise<Mission>;
  refreshMission: (missionId: string) => Promise<Mission | null>;
  deleteMission: (missionId: string) => Promise<void>;
}

const MissionContext = createContext<MissionContextData>({
  missions: [],
  setMissions: () => {},
  createMission: async () => ({} as Mission),
  submitAnswer: async () => ({} as Mission),
  startExecution: async () => ({} as Mission),
  refreshMission: async () => null,
  deleteMission: async () => {},
});

export function useMission() {
  return useContext(MissionContext);
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const [missions, setMissions] = useState<Mission[]>([]);

  const createMission = useCallback(async (data: { title: string; description: string; workspaceId: string }) => {
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json() as { ok: boolean; mission: Mission };
    if (json.ok) {
      setMissions((prev) => [json.mission, ...prev]);
    }
    return json.mission;
  }, []);

  const submitAnswer = useCallback(async (missionId: string, answer: string) => {
    const res = await fetch(`/api/missions/${missionId}/clarify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const json = await res.json() as { ok: boolean; mission: Mission };
    if (json.ok) {
      setMissions((prev) => prev.map((m) => m.id === missionId ? json.mission : m));
    }
    return json.mission;
  }, []);

  const startExecution = useCallback(async (missionId: string) => {
    const res = await fetch(`/api/missions/${missionId}/execute`, {
      method: "POST",
    });
    const json = await res.json() as { ok: boolean; mission: Mission };
    if (json.ok) {
      setMissions((prev) => prev.map((m) => m.id === missionId ? json.mission : m));
    }
    return json.mission;
  }, []);

  const refreshMission = useCallback(async (missionId: string) => {
    const res = await fetch(`/api/missions/${missionId}`);
    const json = await res.json() as { ok: boolean; mission: Mission };
    if (json.ok) {
      setMissions((prev) => prev.map((m) => m.id === missionId ? json.mission : m));
      return json.mission;
    }
    return null;
  }, []);

  const deleteMission = useCallback(async (missionId: string) => {
    await fetch(`/api/missions/${missionId}`, { method: "DELETE" });
    setMissions((prev) => prev.filter((m) => m.id !== missionId));
  }, []);

  return (
    <MissionContext.Provider value={{
      missions,
      setMissions,
      createMission,
      submitAnswer,
      startExecution,
      refreshMission,
      deleteMission,
    }}>
      {children}
    </MissionContext.Provider>
  );
}
