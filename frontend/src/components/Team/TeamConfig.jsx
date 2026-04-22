import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import AgentForm from "./AgentForm";

function newAgent() {
  return {
    id: uuidv4(),
    name: "",
    role: "",
    cli: "claude-code",
    isCoordinator: false,
    systemPrompt: "",
  };
}

export default function TeamConfig({ open, onClose, onSave, initialWorkdir }) {
  const [teamName, setTeamName] = useState("开发团队");
  const [agents, setAgents] = useState([newAgent(), newAgent()]);

  if (!open) return null;

  const save = () => {
    const coordinator = agents.find((item) => item.isCoordinator) || agents[0];
    const normalized = agents.map((agent, index) => ({
      ...agent,
      isCoordinator: coordinator.id === agent.id,
      name: agent.name || `Agent${index + 1}`,
      role: agent.role || "通用执行者",
    }));
    onSave({
      version: "1.0",
      teamName,
      workdir: initialWorkdir,
      agents: normalized,
      coordinatorId: coordinator.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[760px] rounded border border-gray-700 bg-gray-900 p-4">
        <h3 className="mb-3 text-sm font-semibold">创建/编辑 Team</h3>
        <input
          className="mb-3 w-full rounded bg-gray-950 px-2 py-1 text-sm"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="团队名称"
        />
        <div className="space-y-2">
          {agents.map((agent, index) => (
            <AgentForm
              key={agent.id}
              value={agent}
              onChange={(next) =>
                setAgents((prev) => prev.map((item, i) => (i === index ? next : item)))
              }
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded bg-gray-700 px-3 py-1 text-xs"
            onClick={() => setAgents((prev) => [...prev, newAgent()])}
          >
            添加智能体
          </button>
          <button className="rounded bg-blue-600 px-3 py-1 text-xs text-white" onClick={save}>
            保存
          </button>
          <button className="rounded bg-gray-700 px-3 py-1 text-xs" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
