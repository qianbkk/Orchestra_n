import { formatTime, truncate } from "../../utils/formatters";

export default function HistoryList({ items, onView }) {
  return (
    <div className="mt-3 rounded border border-gray-800 bg-gray-900 p-2">
      <div className="mb-2 text-xs text-gray-400">历史任务</div>
      <div className="max-h-56 space-y-2 overflow-auto">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-gray-800 bg-gray-950 p-2 text-xs">
            <div className="text-gray-200">{truncate(item.description, 60)}</div>
            <div className="mt-1 text-gray-500">
              {item.status} · {formatTime(item.createdAt)}
            </div>
            <button className="mt-2 rounded bg-gray-700 px-2 py-1 text-[11px]" onClick={() => onView(item.id)}>
              查看
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
