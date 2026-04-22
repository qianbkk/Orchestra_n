import { useState } from "react";

export default function TaskInput({
  workdir,
  onWorkdirChange,
  onLoadConfig,
  onRunTask,
  running,
  onAbortTask,
}) {
  const [taskDesc, setTaskDesc] = useState("");

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="mb-2 flex gap-2">
        <input
          className="flex-1 rounded bg-gray-950 px-2 py-1 text-sm"
          placeholder="工作目录（绝对路径）"
          value={workdir}
          onChange={(e) => onWorkdirChange(e.target.value)}
        />
        <button className="rounded bg-gray-700 px-3 py-1 text-xs" onClick={onLoadConfig}>
          加载
        </button>
      </div>
      <textarea
        className="h-24 w-full rounded bg-gray-950 p-2 text-sm"
        placeholder="输入任务描述..."
        value={taskDesc}
        onChange={(e) => setTaskDesc(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50"
          onClick={() => onRunTask(taskDesc)}
          disabled={!taskDesc.trim() || running}
        >
          执行任务
        </button>
        <button
          className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50"
          onClick={onAbortTask}
          disabled={!running}
        >
          中止任务
        </button>
      </div>
    </div>
  );
}
