import { create } from "zustand";

const MAX_AGENT_LOGS = 500;

export const useStore = create((set) => ({
  workdir: "",
  teamConfig: null,
  agentStatuses: {},
  agentLogs: {},
  currentTask: null,
  historyList: [],
  viewingHistory: null,
  wsConnected: false,
  timeoutAlert: null,
  leftCollapsed: false,

  setWorkdir: (workdir) => set({ workdir }),
  setTeamConfig: (teamConfig) => set({ teamConfig }),
  setAgentStatuses: (agentStatuses) =>
    set((state) => ({
      agentStatuses:
        typeof agentStatuses === "function"
          ? agentStatuses(state.agentStatuses)
          : agentStatuses,
    })),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setTimeoutAlert: (timeoutAlert) => set({ timeoutAlert }),
  setHistoryList: (historyList) => set({ historyList }),
  setViewingHistory: (viewingHistory) => set({ viewingHistory }),
  toggleLeftCollapsed: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),

  resetTask: () =>
    set({
      currentTask: null,
      timeoutAlert: null,
    }),

  startTask: (description) =>
    set({
      currentTask: {
        id: null,
        description,
        status: "running",
        messages: [],
        finalOutput: "",
        round: 0,
        maxRounds: 10,
      },
    }),

  setCurrentTaskId: (taskId) =>
    set((state) => {
      if (!state.currentTask) return state;
      return { currentTask: { ...state.currentTask, id: taskId } };
    }),

  setTaskProgress: (taskId, round, maxRounds) =>
    set((state) => {
      if (!state.currentTask) return state;
      if (state.currentTask.id && state.currentTask.id !== taskId) return state;
      return {
        currentTask: {
          ...state.currentTask,
          id: state.currentTask.id || taskId,
          round,
          maxRounds,
        },
      };
    }),

  appendTaskMessage: (message) =>
    set((state) => {
      if (!state.currentTask) return state;
      return {
        currentTask: {
          ...state.currentTask,
          messages: [...state.currentTask.messages, message],
        },
      };
    }),

  completeTask: (taskId, output) =>
    set((state) => {
      if (!state.currentTask) return state;
      return {
        currentTask: {
          ...state.currentTask,
          id: state.currentTask.id || taskId,
          status: "completed",
          finalOutput: output,
        },
      };
    }),

  failTask: (error) =>
    set((state) => {
      if (!state.currentTask) return state;
      return {
        currentTask: {
          ...state.currentTask,
          status: "failed",
          finalOutput: error,
        },
      };
    }),

  abortTask: () =>
    set((state) => {
      if (!state.currentTask) return state;
      return {
        currentTask: {
          ...state.currentTask,
          status: "aborted",
        },
      };
    }),

  appendAgentLog: (agentId, logEntry) =>
    set((state) => {
      const logs = state.agentLogs[agentId] || [];
      const nextLogs = [...logs, logEntry];
      const sliced = nextLogs.length > MAX_AGENT_LOGS ? nextLogs.slice(-MAX_AGENT_LOGS) : nextLogs;
      return {
        agentLogs: {
          ...state.agentLogs,
          [agentId]: sliced,
        },
      };
    }),
}));
