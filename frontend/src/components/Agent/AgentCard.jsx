import StatusBadge from "../common/StatusBadge";

export default function AgentCard({ agent, status, onRestart, onSelect }) {
  return (
    <div className="mb-2 rounded border border-gray-800 bg-gray-950 p-2">
      <button className="w-full text-left" onClick={() => onSelect(agent.id)}>
        <div className="flex items-center justify-between">
          <div className="text-sm text-white">{agent.name}</div>
          <StatusBadge state={status?.state || "idle"} />
        </div>
        <div className="mt-1 text-xs text-gray-400">{agent.role}</div>
      </button>
      <button
        className="mt-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200"
        onClick={() => onRestart(agent.id)}
      >
        重启
      </button>
    </div>
  );
}
