export type MemoryType = 'daily_digest' | 'session' | 'task' | 'manual';

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  date: string;            // YYYY-MM-DD
  title: string;
  summary: string;
  highlights: string[];    // bullet points
  metadata: {
    agentId?: string;
    agentName?: string;
    sessionKey?: string;
    taskId?: string;
    taskTitle?: string;
    tasksCompleted?: number;
    activeAgents?: string[];
    sessionCount?: number;
  };
  tags: string[];
  pinned: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}
