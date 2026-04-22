import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";

export function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);
  const debounceRef = useRef(null);
  const queueRef = useRef([]);

  const setWsConnected = useStore((s) => s.setWsConnected);
  const setAgentStatuses = useStore((s) => s.setAgentStatuses);
  const appendAgentLog = useStore((s) => s.appendAgentLog);
  const appendTaskMessage = useStore((s) => s.appendTaskMessage);
  const completeTask = useStore((s) => s.completeTask);
  const failTask = useStore((s) => s.failTask);
  const setTaskProgress = useStore((s) => s.setTaskProgress);
  const setTimeoutAlert = useStore((s) => s.setTimeoutAlert);
  const setCurrentTaskId = useStore((s) => s.setCurrentTaskId);

  useEffect(() => {
    let cancelled = false;

    const flush = () => {
      const events = queueRef.current.splice(0, queueRef.current.length);
      for (const msg of events) {
        if (msg.type === "AGENT_STATUS") {
          setAgentStatuses((prev) => ({ ...prev, [msg.agentId]: msg.status }));
        }
        if (msg.type === "AGENT_OUTPUT") {
          if (msg.taskId) setCurrentTaskId(msg.taskId);
          appendAgentLog(msg.agentId, {
            ts: new Date().toISOString(),
            type: msg.direction === "send" ? "send" : "receive",
            content: msg.content,
          });
          appendTaskMessage({
            ts: new Date().toISOString(),
            agentId: msg.agentId,
            direction: msg.direction,
            content: msg.content,
          });
        }
        if (msg.type === "TASK_PROGRESS") {
          setTaskProgress(msg.taskId, msg.round, msg.maxRounds);
        }
        if (msg.type === "TASK_COMPLETE") {
          completeTask(msg.taskId, msg.output);
          setTimeoutAlert(null);
        }
        if (msg.type === "TASK_ERROR") {
          failTask(msg.error || "Task failed");
        }
        if (msg.type === "TIMEOUT_ALERT") {
          setTimeoutAlert({
            taskId: msg.taskId,
            agentId: msg.agentId,
            secondsElapsed: msg.secondsElapsed,
          });
        }
      }
    };

    const connect = () => {
      const port = import.meta.env.VITE_BACKEND_PORT || 3000;
      const ws = new WebSocket(`ws://localhost:${port}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnectRef.current = 0;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        queueRef.current.push(msg);
        if (debounceRef.current) return;
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          flush();
        }, 50);
      };

      ws.onclose = () => {
        if (cancelled) return;
        setWsConnected(false);
        reconnectRef.current += 1;
        const delay = Math.min(30_000, 500 * 2 ** reconnectRef.current);
        setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      wsRef.current?.close();
    };
  }, [
    appendAgentLog,
    appendTaskMessage,
    completeTask,
    failTask,
    setAgentStatuses,
    setCurrentTaskId,
    setTaskProgress,
    setTimeoutAlert,
    setWsConnected,
  ]);

  const send = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  return { send };
}
