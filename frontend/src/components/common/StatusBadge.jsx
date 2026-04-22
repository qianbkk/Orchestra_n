const styles = {
  idle: "text-gray-400",
  working: "text-blue-400 animate-pulse",
  error: "text-red-400",
};

export default function StatusBadge({ state = "idle" }) {
  return <span className={`text-xs font-semibold ${styles[state] || styles.idle}`}>{state}</span>;
}
