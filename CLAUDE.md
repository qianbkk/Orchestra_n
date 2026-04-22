# CLAUDE.md — Agent Team Orchestrator 系统约束文档

> **定位**：本文件是项目的系统级配置与硬性约束文档，记录不随项目推进而改变的架构决策、技术锁定、安全规则与文件维护规范。除非发生架构级变更，**本文件一般不需要修改**。具体执行步骤、实现细节、验收清单请查阅 `TASK.md`。

---

## 1. 项目定义

**Agent Team Orchestrator (ATO)**：一个本地运行的 Web 应用，允许用户在任意工作目录中创建和管理多个 AI CLI 智能体团队，通过协调者智能体自动分解和分派任务，实现多智能体协作完成长期项目需求。

- 运行环境：localhost 单机，无需认证
- 支持 CLI 工具：Claude Code、Copilot CLI、Codex CLI、Gemini CLI

---

## 2. 已锁定的架构决策

以下决策已最终确定，**实现中不得更改**。若存在无法绕过的技术障碍，须先在 `progress.txt` 中记录原因，再讨论变更。

### 2.1 协调者分派协议

协调者输出子任务分派时，**必须且只能**使用以下 XML 格式：

```xml
<ato-dispatch>
  <task agent="AgentName" mode="serial|parallel" id="唯一ID">
    子任务描述（自然语言，可多行）
  </task>
  <timeout seconds="120" />         <!-- 可选，范围 30–1800 -->
  <collect-after ids="id1,id2" />   <!-- 可选，等待指定任务完成后汇总 -->
</ato-dispatch>
```

- `mode="serial"`：等待前序任务完成后执行
- `mode="parallel"`：与其他 parallel 任务同时执行
- 不含 `<ato-dispatch>` 的回复视为最终答案，直接展示给用户
- 协调者系统提示词必须在保存配置时由 `configManager` 自动注入此协议说明

**系统提示词注入模板**（`configManager.js` 中存为常量 `COORDINATOR_PROMPT_INJECTION`）：

```
You are the coordinator agent. When you need to delegate subtasks to other agents,
output task assignments using ONLY this XML format:

<ato-dispatch>
  <task agent="EXACT_AGENT_NAME" mode="serial|parallel" id="UNIQUE_ID">
    Task description
  </task>
  <timeout seconds="N" />      <!-- optional: 30-1800 -->
  <collect-after ids="..." />  <!-- optional -->
</ato-dispatch>

Available agents: {AGENT_NAMES_LIST}
Use agent names exactly as listed. If no delegation needed, respond directly without XML.
```

### 2.2 超时检测机制

- 全局默认超时：**120 秒**无输出触发
- 健康检查频率：**每 15 秒**轮询所有 `state="working"` 的智能体
- 协调者可通过 `<timeout seconds="N"/>` 在运行时覆盖（30–1800 秒）
- 超时后前端弹出三选一：**继续等待（+120s）/ 重试该子任务 / 中止整个任务**
- 调度引擎不自动推断超时时长，所有动态调整必须来自协调者显式指令

### 2.3 CLI 进程生命周期

采用 **"每消息独立调用 + CLI 自身会话延续"** 策略（非长期 stdin/stdout 管道进程）：

- 每次向智能体发消息时，以子进程方式调用 CLI，读取完整输出后进程退出
- **Claude Code 标准调用方式**：
  ```bash
  claude --dangerously-skip-permissions -c
  ```
  - `--dangerously-skip-permissions`：开启全部权限，无需交互确认
  - `-c`：延续当前目录下的同一会话（`cwd` 不变 + 不开新终端 = 同一对话）
- 其他 CLI 工具的会话延续参数在适配器初始化时通过 `--help` 输出探测后决定
- 若 CLI 不支持会话延续，适配器将前几轮摘要（≤1000 字符）附加到本次 prompt 前

---

## 3. 技术栈（锁定）

| 层 | 技术 | 约束 |
|---|---|---|
| 前端框架 | React 18 + Vite 5 | 不得更换 |
| 前端样式 | TailwindCSS 3 | 不得引入其他 CSS 框架 |
| 前端状态 | Zustand | 不得使用 Redux/Context 替代 |
| 实时通信 | WebSocket（`ws` 库） | 不得改用 SSE 或轮询 |
| 后端 | Node.js（≥18）+ Express 4 | 不得更换语言或框架 |
| 子进程 | Node.js 内置 `child_process.spawn` | 不得引入 `node-pty` 等 native 模块 |
| XML 解析 | `fast-xml-parser` | 用于解析 `<ato-dispatch>` |
| ID 生成 | `uuid` | — |

---

## 4. 项目目录结构（锁定）

```
ato/
├── CLAUDE.md                  ← 本文件（系统约束）
├── TASK.md                    ← 执行任务手册（详细实现步骤与验收清单）
├── README.md                  ← 用户文档
├── index.md                   ← 项目文件索引
├── progress.txt               ← 问题与经验记录
├── package.json               ← 根级（workspaces）
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── scheduler.js
│       ├── agentManager.js
│       ├── configManager.js
│       ├── historyManager.js
│       ├── dispatchParser.js
│       ├── healthChecker.js
│       └── adapters/
│           ├── base.js
│           ├── claudeCode.js
│           ├── copilot.js
│           ├── codex.js
│           └── gemini.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── store/useStore.js
│       ├── hooks/useWebSocket.js
│       ├── components/
│       │   ├── Layout/
│       │   ├── Agent/
│       │   ├── Team/
│       │   ├── Task/
│       │   ├── History/
│       │   └── common/
│       └── utils/formatters.js
└── .gitignore
```

新增文件时：① 遵循上述结构放置；② 必须在 `index.md` 中登记。

---

## 5. 安全硬性规则

以下为强制约束，任何情况下不得违反：

1. **仅监听 localhost**：Express 服务器必须设置 `host: "127.0.0.1"`，严禁使用 `0.0.0.0`
2. **子进程 CWD 锁定**：所有 `spawn` 调用必须显式设置 `cwd: resolvedWorkdir`
3. **路径安全验证**：所有文件操作路径必须经 `path.resolve()` 处理，并验证不含 `..` 跨越（防路径遍历）
4. **不对外暴露接口**：不得添加任何非 localhost 的网络接口
5. **工作目录隔离**：后端调用前须验证目标路径在 workdir 范围内

---

## 6. 文件维护规范

### 6.1 四个核心文件说明

| 文件 | 定位 | 语言 | 修改时机 |
|---|---|---|---|
| `CLAUDE.md` | 系统级约束、锁定架构决策、技术栈、安全规则、文件维护规范 | 中文 | 仅在架构级变更时修改，一般不动 |
| `README.md` | 面向最终用户的完整项目文档：安装、配置、全部功能介绍、详细使用说明 | 中文 | 功能或配置发生变化时同步更新 |
| `index.md` | 项目所有文件的索引：路径、文件类型、简洁说明 | 中文 | 文件增删改移时同步更新 |
| `progress.txt` | 开发过程中遇到的问题、挫折及解决方案，供后续遇到相同情况参考 | 中文 | 遇到问题或找到解决方案时追加 |

### 6.2 强制更新检查（每次改动后必须执行）

**每次完成任何改动之后，CC 必须逐项检查以下四项**，确认是否需要更新对应文件：

```
改动完成 → 强制执行以下检查：

□ index.md   — 有文件新增、删除、移动或重命名？→ 更新索引条目
□ README.md  — 影响用户可感知的功能、配置格式或操作流程？→ 更新对应章节
□ progress.txt — 遇到了问题、报错或值得记录的经验？→ 追加记录
□ CLAUDE.md  — 涉及架构级/系统级变更？（通常不需要）→ 如需更新须谨慎
```

更新要求：
- 按各文件的定位和原有格式排版，不混入不属于该文件定位的内容
- 内容简洁明了，避免冗余重复
- 四个文件均使用**中文**

---

*文档版本：v1.1 | 最后更新：2026-04-19*
