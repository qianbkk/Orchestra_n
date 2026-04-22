export default function TimeoutModal({ alert, onAction }) {
  if (!alert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[520px] rounded border border-gray-700 bg-gray-900 p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">智能体超时</h3>
        <p className="mb-4 text-sm text-gray-300">
          Agent <span className="font-mono">{alert.agentId}</span> 已 {alert.secondsElapsed}s 无输出。
        </p>
        <div className="flex gap-2">
          <button
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white"
            onClick={() => onAction("wait")}
          >
            继续等待（+120s）
          </button>
          <button
            className="rounded bg-amber-600 px-3 py-1 text-xs text-white"
            onClick={() => onAction("retry")}
          >
            重试该子任务
          </button>
          <button
            className="rounded bg-red-600 px-3 py-1 text-xs text-white"
            onClick={() => onAction("abort")}
          >
            中止整个任务
          </button>
        </div>
      </div>
    </div>
  );
}
