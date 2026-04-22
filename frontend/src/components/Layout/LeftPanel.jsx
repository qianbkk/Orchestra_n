export default function LeftPanel({ children }) {
  return <div className="h-[calc(100%-37px)] overflow-hidden p-2">{children}</div>;
}
