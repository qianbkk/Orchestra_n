export default function AgentForm({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded border border-gray-700 p-2">
      <input
        className="rounded bg-gray-950 px-2 py-1 text-sm"
        placeholder="名称"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <select
        className="rounded bg-gray-950 px-2 py-1 text-sm"
        value={value.cli}
        onChange={(e) => onChange({ ...value, cli: e.target.value })}
      >
        <option value="claude-code">claude-code</option>
        <option value="gemini">gemini</option>
        <option value="codex">codex</option>
        <option value="copilot">copilot</option>
      </select>
      <input
        className="col-span-2 rounded bg-gray-950 px-2 py-1 text-sm"
        placeholder="角色描述"
        value={value.role}
        onChange={(e) => onChange({ ...value, role: e.target.value })}
      />
      <label className="col-span-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={value.isCoordinator}
          onChange={(e) => onChange({ ...value, isCoordinator: e.target.checked })}
        />
        设为协调者
      </label>
      {value.cli === "copilot" ? (
        <p className="col-span-2 text-xs text-amber-400">
          ⚠️ Copilot CLI 主要面向命令建议，用于通用对话任务时效果可能有限
        </p>
      ) : null}
    </div>
  );
}
