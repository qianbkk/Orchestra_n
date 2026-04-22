import React, { useEffect, useState } from "react";
import SplitLayout from "./components/Layout/SplitLayout";
import LeftPanel from "./components/Layout/LeftPanel";
import RightPanel from "./components/Layout/RightPanel";
import AgentList from "./components/Agent/AgentList";
import AgentLogViewer from "./components/Agent/AgentLogViewer";
import TeamConfig from "./components/Team/TeamConfig";
import TaskInput from "./components/Task/TaskInput";
import MessageFeed from "./components/Task/MessageFeed";
import TaskProgress from "./components/Task/TaskProgress";
import HistoryList from "./components/History/HistoryList";
import HistoryViewer from "./components/History/HistoryViewer";
import ConnectionStatus from "./components/common/ConnectionStatus";
import TimeoutModal from "./components/common/TimeoutModal";
import { useStore } from "./store/useStore";
import { useWebSocket } from "./hooks/useWebSocket";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="rounded border border-red-700 bg-red-950 p-3 text-xs text-red-300">组件渲染失败</div>;
    }
    return this.props.children;
  }
}

export default function App() {
  const { send } = useWebSocket();
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  const workdir = useStore((s) => s.workdir);
  const setWorkdir = useStore((s) => s.setWorkdir);
  const teamConfig = useStore((s) => s.teamConfig);
  const setTeamConfig = useStore((s) => s.setTeamConfig);
  const statuses = useStore((s) => s.agentStatuses);
  const logs = useStore((s) => s.agentLogs);
  const currentTask = useStore((s) => s.currentTask);
  const startTask = useStore((s) => s.startTask);
  const abortTask = useStore((s) => s.abortTask);
  const timeoutAlert = useStore((s) => s.timeoutAlert);
  const setTimeoutAlert = useStore((s) => s.setTimeoutAlert);
  const historyList = useStore((s) => s.historyList);
  const setHistoryList = useStore((s) => s.setHistoryList);
  const viewingHistory = useStore((s) => s.viewingHistory);
  const setViewingHistory = useStore((s) => s.setViewingHistory);

  const loadConfig = async () => {
    if (!workdir.trim()) return;
    const res = await fetch(`/api/config?workdir=${encodeURIComponent(workdir)}`);
    const data = await res.json();
    if (data.config) {
      setTeamConfig(data.config);
    } else {
      setTeamModalOpen(true);
    }

    const historyRes = await fetch(`/api/history?workdir=${encodeURIComponent(workdir)}`);
    const historyData = await historyRes.json();
    setHistoryList(historyData.tasks || []);
  };

  const saveConfig = async (config) => {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workdir, config }),
    });
    const data = await res.json();
    if (data.ok) {
      setTeamConfig(config);
      setTeamModalOpen(false);
    }
  };

  const runTask = (taskDesc) => {
    startTask(taskDesc);
    send({ type: "RUN_TASK", workdir, taskDesc });
  };

  const abortCurrentTask = () => {
    if (!currentTask?.id) return;
    send({ type: "ABORT_TASK", taskId: currentTask.id });
    abortTask();
  };

  const restartAgent = async (agentId) => {
    await fetch(`/api/agents/${agentId}/restart`, { method: "POST" });
  };

  const loadHistoryTask = async (taskId) => {
    const res = await fetch(`/api/history/${taskId}?workdir=${encodeURIComponent(workdir)}`);
    const data = await res.json();
    setViewingHistory(data.task || null);
  };

  const handleTimeoutAction = (action) => {
    if (!timeoutAlert) return;
    send({
      type: "TIMEOUT_RESPONSE",
      taskId: timeoutAlert.taskId,
      agentId: timeoutAlert.agentId,
      action,
    });
    setTimeoutAlert(null);
    if (action === "abort") abortTask();
  };

  useEffect(() => {
    if (!workdir) return;
    loadConfig();
  }, []);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
        <h1 className="text-sm font-semibold text-white">Agent Team Orchestrator</h1>
        <ConnectionStatus />
      </div>

      <SplitLayout
        left={
          <ErrorBoundary>
            <LeftPanel>
              <div className="mb-2 flex gap-2">
                <button className="rounded bg-gray-700 px-2 py-1 text-xs" onClick={() => setTeamModalOpen(true)}>
                  创建/编辑 Team
                </button>
              </div>
              <AgentList
                teamConfig={teamConfig}
                statuses={statuses}
                onRestart={restartAgent}
                onSelect={setSelectedAgentId}
              />
              {selectedAgentId ? (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-gray-400">Agent 日志</div>
                  <AgentLogViewer logs={logs[selectedAgentId] || []} />
                </div>
              ) : null}
              <HistoryList items={historyList} onView={loadHistoryTask} />
            </LeftPanel>
          </ErrorBoundary>
        }
        right={
          <ErrorBoundary>
            <RightPanel>
              <TaskInput
                workdir={workdir}
                onWorkdirChange={setWorkdir}
                onLoadConfig={loadConfig}
                onRunTask={runTask}
                running={currentTask?.status === "running"}
                onAbortTask={abortCurrentTask}
              />
              <TaskProgress task={currentTask} statuses={statuses} teamConfig={teamConfig} />
              <MessageFeed task={currentTask} />
              <ErrorBoundary>
                <HistoryViewer task={viewingHistory} />
              </ErrorBoundary>
            </RightPanel>
          </ErrorBoundary>
        }
      />

      <TeamConfig
        open={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        onSave={saveConfig}
        initialWorkdir={workdir}
      />
      <TimeoutModal alert={timeoutAlert} onAction={handleTimeoutAction} />
    </div>
  );
}
