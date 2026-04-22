import { useStore } from "../../store/useStore";

export default function SplitLayout({ left, right }) {
  const collapsed = useStore((s) => s.leftCollapsed);
  const toggle = useStore((s) => s.toggleLeftCollapsed);

  return (
    <div className="flex h-full">
      <aside className={`${collapsed ? "w-12" : "w-[320px]"} border-r border-gray-800 bg-gray-900`}>
        <button
          className="w-full border-b border-gray-800 px-3 py-2 text-left text-xs text-gray-300"
          onClick={toggle}
        >
          {collapsed ? "▶ 展开" : "◀ 折叠"}
        </button>
        {!collapsed ? left : null}
      </aside>
      <main className="min-w-0 flex-1 bg-gray-950">{right}</main>
    </div>
  );
}
