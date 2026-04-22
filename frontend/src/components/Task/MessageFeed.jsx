import { formatTime } from "../../utils/formatters";

export default function MessageFeed({ task }) {
  return (
    <div className="mt-3 rounded border border-gray-800 bg-black p-3 font-mono text-xs">
      <div className="mb-2 text-gray-400">消息流</div>
      <div className="max-h-80 space-y-2 overflow-auto">
        {(task?.messages || []).map((msg, index) => (
          <div key={`${msg.ts}-${index}`} className="rounded border border-gray-900 p-2">
            <div className="mb-1 text-[10px] text-gray-500">
              {formatTime(msg.ts)} · {msg.agentId} · {msg.direction}
            </div>
            <div className={msg.direction === "send" ? "text-blue-300" : "text-green-300"}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      {task?.finalOutput ? (
        <div className="mt-3 rounded border border-gray-800 bg-gray-950 p-2 text-gray-200">
          <div className="mb-1 text-[10px] text-gray-500">最终输出</div>
          <pre className="whitespace-pre-wrap">{task.finalOutput}</pre>
        </div>
      ) : null}
    </div>
  );
}
