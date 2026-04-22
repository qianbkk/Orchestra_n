import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatTime } from "../../utils/formatters";

export default function AgentLogViewer({ logs }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="h-64 overflow-auto rounded border border-gray-800 bg-black font-mono text-xs">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((item) => {
          const log = logs[item.index];
          return (
            <div
              key={item.key}
              className="absolute left-0 top-0 w-full border-b border-gray-900 px-2 py-1 text-gray-300"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <div className="text-[10px] text-gray-500">{formatTime(log.ts)} · {log.type}</div>
              <div className="whitespace-pre-wrap break-words">{log.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
