export default function HistoryViewer({ task }) {
  if (!task) return null;
  return (
    <div className="mt-3 rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-400">历史回放（只读）</div>
      <h3 className="mt-1 text-sm text-white">{task.description}</h3>
      <div className="mt-2 max-h-72 space-y-2 overflow-auto font-mono text-xs">
        {(task.logs || []).map((log, index) => (
          <div key={`${log.ts}-${index}`} className="rounded border border-gray-800 bg-gray-950 p-2">
            <div className="text-[10px] text-gray-500">
              {log.ts} · {log.agentName} · {log.type}
            </div>
            <pre className="whitespace-pre-wrap text-gray-300">{log.content}</pre>
          </div>
        ))}
      </div>
      {task.finalOutput ? (
        <div className="mt-3 rounded border border-gray-800 bg-black p-2 text-xs text-gray-200">
          <div className="mb-1 text-gray-500">最终输出</div>
          <pre className="whitespace-pre-wrap">{task.finalOutput}</pre>
        </div>
      ) : null}
    </div>
  );
}
