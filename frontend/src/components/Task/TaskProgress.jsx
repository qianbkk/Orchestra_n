export default function TaskProgress({ task, statuses, teamConfig }) {
  if (!task) return null;
  return (
    <div className="mt-3 rounded border border-gray-800 bg-gray-900 p-3 text-xs text-gray-300">
      <div>
        轮次：{task.round}/{task.maxRounds}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(teamConfig?.agents || []).map((agent) => (
          <div key={agent.id} className="rounded border border-gray-800 bg-gray-950 p-2">
            <span className="text-gray-200">{agent.name}</span>
            <span className="ml-2 text-gray-400">{statuses[agent.id]?.state || "idle"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
