export function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString();
}

export function truncate(text, limit = 80) {
  const value = String(text || "");
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
}
