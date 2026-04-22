# TASK.md — ATO 执行任务手册

> **定位**：本文件是下游 CC 代理的详细执行手册，包含分阶段实现步骤、模块接口定义、关键算法说明与验收自测清单。随项目推进可按需更新。架构级约束请以 `CLAUDE.md` 为准。

---

## 0. 执行前必读

1. 先完整阅读 `CLAUDE.md`，所有锁定决策（分派协议、超时机制、CLI 生命周期）不得更改
2. 按本文档 §1 → §2 → §3 → §4 的顺序执行，不得跳步
3. 每完成一个模块，在本文档末尾的 **完成清单** 中标记 `[x]`
4. 每次改动完成后执行 `CLAUDE.md §6.2` 中的四项强制检查

---

## 1. Phase 1 — 核心骨架

**目标**：实现 AC1（Team 配置）、AC2（基本任务协作）、AC6（错误恢复），完成可运行的 MVP。

### 1.1 初始化项目结构与依赖

```bash
mkdir ato && cd ato

# 根 package.json
npm init -y
# 手动编辑，加入：
# "workspaces": ["backend","frontend"],
# "scripts": { "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"" }
npm install -D concurrently

# 后端
mkdir -p backend/src/adapters
cd backend && npm init -y
npm install express ws uuid fast-xml-parser

# 前端
cd ../frontend
npm create vite@latest . -- --template react
npm install zustand @tanstack/react-virtual
npm install -D tailwindcss @tailwindcss/vite
npx tailwindcss init -p
```

完成后验证：`node --version`（需 ≥18），`ls backend/node_modules`，`ls frontend/node_modules`

---

### 1.2 后端模块实现顺序

每个文件完成后在顶部加注释 `// DONE: <模块名>`，并运行 `node --check src/xxx.js` 验证无语法错误。

#### configManager.js

职责：读写 `<workdir>/.agent-team` 配置文件。

**接口**：
- `loadConfig(workdir)` → `TeamConfig | null`
- `saveConfig(workdir, config)` → `void`（保存时自动注入协调者系统提示词）

**TeamConfig schema**：
```json
{
  "version": "1.0",
  "teamName": "string",
  "workdir": "string",
  "agents": [
    {
      "id": "uuid",
      "name": "string",
      "role": "string",
      "cli": "claude-code|copilot|codex|gemini",
      "isCoordinator": true,
      "systemPrompt": "string（保存时自动注入，无需前端传入）"
    }
  ],
  "coordinatorId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

注意：`saveConfig` 在写入前，找到 `coordinatorId` 对应的 agent，将 `COORDINATOR_PROMPT_INJECTION`（含真实 agent 名称列表）写入其 `systemPrompt`，覆盖前端传来的值。

---

#### historyManager.js

职责：管理 `<workdir>/.agent-history/` 目录下的任务历史文件。

**接口**：
- `createTask(workdir, taskDesc)` → `TaskRecord`
- `appendLog(workdir, taskId, agentId, agentName, type, content)` → `void`
  - `type`：`"send" | "receive" | "dispatch" | "error" | "system"`
- `finalizeTask(workdir, taskId, finalOutput, status)` → `void`
  - `status`：`"completed" | "failed" | "aborted"`
- `listTasks(workdir)` → `TaskSummary[]`（按 createdAt 倒序）
- `loadTask(workdir, taskId)` → `TaskRecord | null`

**历史文件格式** `.agent-history/<taskId>.json`：
```json
{
  "id": "uuid",
  "description": "用户输入的任务描述",
  "status": "running|completed|failed|aborted",
  "createdAt": "ISO8601",
  "completedAt": "ISO8601|null",
  "finalOutput": "string|null",
  "logs": [
    {
      "ts": "ISO8601",
      "agentId": "uuid",
      "agentName": "string",
      "type": "send|receive|dispatch|error|system",
      "content": "string"
    }
  ]
}
```

---

#### dispatchParser.js

职责：从协调者输出文本中提取并解析 `<ato-dispatch>` 块。

**接口**：
- `parseDispatch(text)` → `DispatchResult | null`

```javascript
// DispatchResult:
{
  tasks: [{ agent: string, mode: "serial"|"parallel", id: string, content: string }],
  timeoutSeconds: number | null,
  collectAfterIds: string[] | null,
  remainingText: string  // <ato-dispatch>块之外的文本
}
```

实现要点：
- 使用 `fast-xml-parser` 宽松模式解析
- 支持同一输出中多个 `<ato-dispatch>` 块（合并 tasks）
- Agent 名称匹配：normalize（toLowerCase + trim）后再比对
- XML 解析失败：记录警告到 console，返回 `null`（视为无分派）

---

#### adapters/base.js

定义 CLIAdapter 基类接口（JSDoc 注释）：

```javascript
/**
 * @interface CLIAdapter
 */
class CLIAdapter {
  constructor(agent, workdir) {}
  // 发送消息并返回完整输出；onChunk 为流式回调（每收到数据段即调用）
  async sendMessage(message, onChunk) { throw new Error('Not implemented') }
  // 检查 CLI 可执行文件是否在 PATH 中可用
  async checkAvailable() { throw new Error('Not implemented') }
  // 返回当前会话 ID（若无则 null）
  getSessionId() { return null }
  // 清除本地会话状态
  clearSession() {}
}
```

---

#### adapters/claudeCode.js

```javascript
// 可用性检测：spawnSync('claude', ['--version'])
// 会话延续检测：首次初始化时运行 `claude --help`，检测输出中是否含 "--continue" 或 "-c"
// 标准调用：spawn('claude', ['--dangerously-skip-permissions', '-c'], { cwd, input: message })
// 降级调用（不支持 -c 时）：spawn('claude', ['--dangerously-skip-permissions', '-p', message], { cwd })
// stdout 数据通过 onChunk 实时回调，进程退出后返回完整拼接文本
// 单次调用最长 600 秒（spawn timeout 参数）
// spawn 选项：{ cwd: workdir, env: { ...process.env }, encoding: 'utf8' }
```

---

#### adapters/gemini.js / codex.js / copilot.js

与 claudeCode.js 结构一致，差异点：
- **Gemini**：检测命令 `gemini --version`，会话参数 `--session` 或 `-c`（运行时探测）
- **Codex**：检测命令 `codex --version`，调用 `codex -p "<message>"`（探测会话参数）
- **Copilot**：检测命令 `gh copilot --version`，主要面向命令建议，非通用对话；`sendMessage` 内追加警告到返回文本

所有适配器：`checkAvailable()` 失败时 `sendMessage` 抛出 `CLINotAvailableError`，错误消息含安装提示。

---

#### agentManager.js

职责：管理所有智能体的适配器实例和状态。

**接口**：
- `init(teamConfig, workdir)` → 初始化各适配器实例
- `getAdapter(agentId)` → `CLIAdapter`
- `getStatus(agentId)` → `{ state: "idle"|"working"|"error", lastActivity: Date, error: string|null }`
- `setWorking(agentId)` / `setIdle(agentId)` / `setError(agentId, error)`
- `restartAgent(agentId)` → 重置适配器实例并将状态设为 idle
- `getAllStatuses()` → `{ [agentId]: AgentStatus }`

---

#### healthChecker.js

职责：定期检测工作中智能体的超时状态。

**接口**：
- `start(agentManager, onTimeout)` → 启动每 15 秒的定时器
- `stop()` → 清除定时器
- `updateActivity(agentId)` → 重置该 agent 的最后活动时间（收到输出时调用）
- `setTimeoutOverride(agentId, seconds)` → 设置该 agent 本次任务的超时时长

`onTimeout(agentId, taskId)` 回调由 `index.js` 注入，通过 WS 广播 `TIMEOUT_ALERT` 事件。

---

#### scheduler.js（核心模块）

职责：接收用户任务 → 驱动协调者 → 解析分派 → 驱动执行者 → 汇总结果。

**接口**：
```javascript
async runTask(taskDesc, teamConfig, workdir, callbacks)
```

**callbacks 类型**：
```javascript
{
  onAgentMessage: (agentId, direction, content) => void,  // direction: "send"|"receive"
  onDispatchParsed: (dispatchResult) => void,
  onAgentStatusChange: (agentId, status) => void,
  onTaskComplete: (finalOutput) => void,
  onError: (agentId, error) => void,
  onLog: (level, message) => void,
}
```

**调度核心逻辑（伪代码）**：
```
MAX_ROUNDS = 10
round = 0

1. 向协调者发送：taskDesc + "Team成员：[AgentName1(角色), AgentName2(角色)...]"
2. 循环（最多 MAX_ROUNDS 次）：
   a. 解析协调者输出 → dispatchParser.parseDispatch(output)
   b. 若无分派块：finalOutput = output，退出循环
   c. 若有分派块：
      - 提取 serial 任务（按顺序逐个执行）
      - 提取 parallel 任务（Promise.all 同时执行）
      - 收集所有执行结果
      - 格式化汇总："来自{AgentName}的结果：\n{output}\n---\n..."
      - 将汇总结果发给协调者
3. 返回 finalOutput
```

每次 `sendMessage` 前后：
- 调用 `agentManager.setWorking/setIdle`
- 调用 `historyManager.appendLog`
- 实时流通过 `onAgentMessage` 回调传递（不等完成再传）
- 调用 `healthChecker.updateActivity` 每次收到 chunk 时

---

#### index.js（服务器入口）

**REST API**：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config?workdir=` | 加载 Team 配置 |
| POST | `/api/config` | 保存 Team 配置 `{ workdir, config }` |
| GET | `/api/history?workdir=` | 列出历史任务 |
| GET | `/api/history/:taskId?workdir=` | 加载单个历史任务 |
| GET | `/api/agents/status` | 获取所有智能体状态 |
| POST | `/api/agents/:id/restart` | 重启指定智能体 |
| GET | `/api/health` | `{ status: "ok" }` |

**WebSocket 事件（服务端 → 客户端）**：
```
{ type: "AGENT_STATUS", agentId, status }
{ type: "AGENT_OUTPUT", agentId, taskId, content, direction }
{ type: "TASK_PROGRESS", taskId, round, maxRounds }
{ type: "TASK_COMPLETE", taskId, output }
{ type: "TASK_ERROR", taskId, agentId, error }
{ type: "TIMEOUT_ALERT", taskId, agentId, secondsElapsed }
{ type: "DISPATCH_EVENT", taskId, dispatch }
```

**WebSocket 事件（客户端 → 服务端）**：
```
{ type: "RUN_TASK", workdir, taskDesc }
{ type: "TIMEOUT_RESPONSE", taskId, agentId, action }  // "wait"|"retry"|"abort"
{ type: "ABORT_TASK", taskId }
```

服务器配置：`host: "127.0.0.1"`，端口默认 `3001`（可通过 `ATO_PORT` 环境变量覆盖）。

---

### 1.3 前端模块实现顺序

#### Vite 配置（frontend/vite.config.js）

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    }
  }
})
```

**frontend/src/index.css**：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### UI 风格约束

- 整体深色主题：`bg-gray-950` 背景，`bg-gray-900` 面板
- 状态颜色：idle = `text-gray-400`，working = `text-blue-400`（加 pulse 动画），error = `text-red-400`
- 日志区使用等宽字体（`font-mono`），其余 UI 使用 sans-serif
- 信息密度优先，避免花哨动效

#### store/useStore.js（Zustand）

```javascript
// State 结构：
{
  workdir: string,
  teamConfig: TeamConfig | null,
  agentStatuses: { [agentId]: AgentStatus },
  agentLogs: { [agentId]: LogEntry[] },  // 最多保留最新 500 条/agent，超出从头部删除
  currentTask: { id, description, status, messages: [], finalOutput } | null,
  historyList: TaskSummary[],
  viewingHistory: TaskRecord | null,
  wsConnected: boolean,
  timeoutAlert: { taskId, agentId, secondsElapsed } | null,
}
```

#### hooks/useWebSocket.js

- 连接到 `ws://localhost:${VITE_BACKEND_PORT || 3001}`
- 自动重连：指数退避，最大 30 秒间隔
- 收到消息后 dispatch 到 Zustand store 对应的 action

#### 组件实现优先级

**P1（Phase 1 必须完成）**：
1. `Layout/SplitLayout.jsx`：左侧 320px 固定，右侧 flex-1，左侧可折叠
2. `common/StatusBadge.jsx`：idle/working/error 状态标识
3. `common/ConnectionStatus.jsx`：右上角 WS 连接状态指示点
4. `Agent/AgentList.jsx` + `Agent/AgentCard.jsx`：智能体列表与状态卡片
5. `Agent/AgentLogViewer.jsx`：点击展开，**必须使用 `@tanstack/react-virtual` 虚拟滚动**
6. `Team/TeamConfig.jsx` + `Team/AgentForm.jsx`：创建/编辑 Team 模态表单
7. `Task/TaskInput.jsx`：工作目录输入框 + 任务文本框 + 提交按钮
8. `Task/MessageFeed.jsx`：任务执行消息流（发送/接收/系统消息颜色区分）
9. `common/TimeoutModal.jsx`：超时弹窗，三个按钮

**P2（Phase 2 补充完成）**：
10. `Task/TaskProgress.jsx`：任务进度摘要（当前轮次、各 agent 状态）
11. `History/HistoryList.jsx` + `History/HistoryViewer.jsx`：历史任务只读查看

**P3（Nice-to-have，时间允许）**：
- 预设角色模板（后端开发/前端开发/测试/架构师）
- 历史搜索与过滤
- 并行任务可视化

#### 错误边界

`LeftPanel`、`RightPanel`、`HistoryViewer` 每个主要面板必须包裹 React ErrorBoundary，防止单组件崩溃导致全页白屏。

---

### 1.4 启动脚本配置

**根 package.json**：
```json
{
  "name": "ato",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w frontend",
    "start": "node backend/src/index.js"
  }
}
```

**backend/package.json scripts**：
```json
{
  "dev": "node --watch src/index.js",
  "start": "node src/index.js",
  "test": "node --test tests/"
}
```

---

## 2. Phase 2 — 完整功能

**目标**：实现 AC3（超时）、AC4（历史回放）、AC5（并行协作），补全 Gemini/Codex/Copilot 适配器。

实现顺序：
1. `healthChecker.js` 完整实现 + `TimeoutModal.jsx` 接入（AC3）
2. `HistoryList.jsx` + `HistoryViewer.jsx` 完整实现（AC4）
3. 前端 `TaskProgress.jsx` 补充并行状态显示（AC5）
4. `adapters/gemini.js`、`adapters/codex.js`、`adapters/copilot.js` 补全
5. `ConnectionStatus.jsx` 补全重连逻辑
6. 全量 AC1–AC6 验收测试

---

## 3. Phase 3 — Nice-to-have（可选）

实现顺序（各项独立，可按需选择）：
1. 预设角色模板库
2. 历史任务搜索与过滤
3. 并行任务协作流程图可视化（使用 SVG 或 `reactflow`）
4. 手动暂停/恢复单个智能体

---

## 4. 关键实现注意事项

1. **日志性能**：`agentLogs` 每个 agent 最多 500 条，超出时从数组头部移除。`AgentLogViewer` 必须使用 `@tanstack/react-virtual`
2. **子进程清理**：任务中止时须显式调用 `process.kill()` 终止所有活跃子进程，并在进程退出时调用 `unref()` 防止阻塞主进程退出
3. **分派最大轮次**：`scheduler.js` 中 `MAX_DISPATCH_ROUNDS = 10`，超出后强制结束，返回当前已收集输出
4. **WS 广播结构**：虽当前为单 workdir，广播函数签名保留 `broadcastToWorkdir(workdir, message)` 结构，便于后续扩展
5. **Copilot 警告**：`AgentForm.jsx` 中选择 `copilot` 时显示内联警告：`⚠️ Copilot CLI 主要面向命令建议，用于通用对话任务时效果可能有限`
6. **输出 debounce**：前端 WS 消息处理加 50ms debounce，防止高频更新触发过多 re-render

---

## 5. 验收自测清单

```
AC1: Team 创建与加载
  □ 空目录打开应用，显示"创建首个 Team"引导
  □ 添加 2 个智能体（不同 CLI），保存配置 → .agent-team 文件生成
  □ 重启应用后自动加载先前配置

AC2: 基本任务协作（串行）
  □ 提交任务后，左侧 Agent 状态变为 working → idle
  □ 右侧显示消息流，发送/接收消息可视觉区分
  □ 任务完成后显示最终输出文本

AC3: 超时提醒
  □ 在 claudeCode 适配器 sendMessage 加入 setTimeout 模拟 130 秒延迟
  □ 约 2 分钟内前端弹出超时提示（3个按钮）
  □ 点击"中止"后 Agent 状态变为 error，任务状态变为 aborted

AC4: 历史回放
  □ 历史列表中找到已完成任务
  □ 点击查看完整日志（含消息序列和最终输出）
  □ 界面中无任何编辑控件

AC5: 并行协作
  □ 协调者输出含两个 mode="parallel" 的 task
  □ 两个 Agent 同时进入 working 状态（日志时间戳接近）
  □ 两个结果均被收集并发回协调者

AC6: 错误恢复
  □ 使 claudeCode 适配器 sendMessage throw Error
  □ 前端 Agent 卡片显示红色 error 状态
  □ 点击"重启"按钮后适配器实例重建，状态恢复 idle
```

---

## 6. 完成清单

CC 代理每完成一个模块，在对应项前将 `[ ]` 改为 `[x]`：

```
后端
[x] configManager.js
[x] historyManager.js
[x] dispatchParser.js
[x] adapters/base.js
[x] adapters/claudeCode.js
[x] adapters/gemini.js
[x] adapters/codex.js
[x] adapters/copilot.js
[x] agentManager.js
[x] healthChecker.js
[x] scheduler.js
[x] index.js（服务器入口）

前端
[x] store/useStore.js
[x] hooks/useWebSocket.js
[x] App.jsx + main.jsx
[x] Layout/SplitLayout.jsx
[x] Layout/LeftPanel.jsx + RightPanel.jsx
[x] Agent/AgentList.jsx + AgentCard.jsx
[x] Agent/AgentLogViewer.jsx（含虚拟滚动）
[x] Team/TeamConfig.jsx + AgentForm.jsx
[x] Task/TaskInput.jsx
[x] Task/MessageFeed.jsx
[x] Task/TaskProgress.jsx
[x] History/HistoryList.jsx + HistoryViewer.jsx
[x] common/StatusBadge.jsx
[x] common/TimeoutModal.jsx
[x] common/ConnectionStatus.jsx

配置与脚本
[x] 根 package.json（workspaces + scripts）
[x] backend/package.json
[x] frontend/package.json + vite.config.js
[x] tailwind.config.js + index.css
[x] .gitignore
```

---

*文档版本：v1.0 | 最后更新：2026-04-19*
