import AgentCard from "./AgentCard";

export default function AgentList({ teamConfig, statuses, onRestart, onSelect }) {
  if (!teamConfig) {
    return <div className="text-xs text-gray-400">未加载 Team 配置</div>;
  }

  return (
    <div>
      {teamConfig.agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          status={statuses[agent.id]}
          onRestart={onRestart}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
