import { useStore } from "../../store/useStore";

export default function ConnectionStatus() {
  const connected = useStore((s) => s.wsConnected);
  const color = connected ? "bg-green-500" : "bg-red-500";
  const label = connected ? "已连接" : "断开";

  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span>WS {label}</span>
    </div>
  );
}
