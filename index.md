# index.md — 项目文件索引

> **定位**：记录本项目所有文件的路径、类型与简洁说明。每次新增、删除、移动或重命名文件后必须同步更新本索引。

---

## 项目根目录

| 文件路径 | 类型 | 说明 |
|---|---|---|
| `CLAUDE.md` | 文档 | 系统级约束文档：架构决策、技术栈锁定、安全规则、文件维护规范 |
| `TASK.md` | 文档 | 执行任务手册：分阶段实现步骤、模块接口定义、验收清单 |
| `README.md` | 文档 | 用户文档：安装说明、功能介绍、使用指南、配置格式参考 |
| `index.md` | 文档 | 本文件：项目所有文件的索引 |
| `progress.txt` | 文档 | 开发过程问题与经验记录 |
| `.github/copilot-instructions.md` | 文档 | Copilot 指令文件：由 CLAUDE.md 转换的系统约束与实现规则 |
| `package.json` | 配置 | 根级 npm 配置，含 workspaces 和开发脚本 |
| `run.bat` | 脚本 | Windows 启动器：一键启动/关闭前后端并检查状态 |
| `.gitignore` | 配置 | Git 忽略规则 |

---

## 后端（backend/）

| 文件路径 | 类型 | 说明 |
|---|---|---|
| `backend/package.json` | 配置 | 后端 npm 配置与依赖（express、ws、uuid、fast-xml-parser） |
| `backend/src/index.js` | 源码 | Express + WebSocket 服务器入口，REST API 路由定义 |
| `backend/src/scheduler.js` | 源码 | 核心调度引擎：任务分发、多轮协调-执行循环、结果聚合 |
| `backend/src/agentManager.js` | 源码 | 智能体适配器实例管理与状态跟踪 |
| `backend/src/configManager.js` | 源码 | `.agent-team` 配置文件读写，协调者系统提示词自动注入 |
| `backend/src/historyManager.js` | 源码 | `.agent-history/` 历史存档读写 |
| `backend/src/dispatchParser.js` | 源码 | `<ato-dispatch>` XML 分派指令解析器 |
| `backend/src/healthChecker.js` | 源码 | 智能体超时检测定时器（每 15 秒轮询） |
| `backend/src/adapters/base.js` | 源码 | CLIAdapter 基类接口定义（JSDoc） |
| `backend/src/adapters/claudeCode.js` | 源码 | Claude Code CLI 适配器（`claude --dangerously-skip-permissions -c`） |
| `backend/src/adapters/gemini.js` | 源码 | Gemini CLI 适配器 |
| `backend/src/adapters/codex.js` | 源码 | Codex CLI 适配器 |
| `backend/src/adapters/copilot.js` | 源码 | GitHub Copilot CLI 适配器（主要面向命令建议场景） |
| `backend/tests/smoke.test.js` | 测试 | 后端基础烟雾测试（分派 XML 解析） |

---

## 前端（frontend/）

| 文件路径 | 类型 | 说明 |
|---|---|---|
| `frontend/package.json` | 配置 | 前端 npm 配置与依赖（React、Vite、Zustand、TailwindCSS 等） |
| `frontend/vite.config.js` | 配置 | Vite 构建配置，含 API 反向代理设置 |
| `frontend/tailwind.config.js` | 配置 | TailwindCSS 配置 |
| `frontend/index.html` | 入口 | HTML 入口文件 |
| `frontend/src/main.jsx` | 源码 | React 应用挂载入口 |
| `frontend/src/App.jsx` | 源码 | 应用根组件，路由与全局布局 |
| `frontend/src/index.css` | 样式 | TailwindCSS 指令导入 |
| `frontend/src/store/useStore.js` | 源码 | Zustand 全局状态管理（智能体状态、日志、任务、历史等） |
| `frontend/src/hooks/useWebSocket.js` | 源码 | WebSocket 连接管理 Hook，含自动重连与消息分发 |
| `frontend/src/utils/formatters.js` | 源码 | 日期格式化、日志截断等工具函数 |
| `frontend/src/components/Layout/SplitLayout.jsx` | 源码 | 左右分栏主布局，左侧可折叠 |
| `frontend/src/components/Layout/LeftPanel.jsx` | 源码 | 左侧面板容器（智能体列表 + 历史记录标签） |
| `frontend/src/components/Layout/RightPanel.jsx` | 源码 | 右侧主区域容器（任务输入 + 消息流 + 历史查看） |
| `frontend/src/components/Agent/AgentList.jsx` | 源码 | 智能体列表渲染组件 |
| `frontend/src/components/Agent/AgentCard.jsx` | 源码 | 单个智能体状态卡片，含状态 badge 和展开按钮 |
| `frontend/src/components/Agent/AgentLogViewer.jsx` | 源码 | 智能体详细日志查看器（虚拟滚动，最多 500 条） |
| `frontend/src/components/Team/TeamConfig.jsx` | 源码 | 团队创建/编辑模态表单 |
| `frontend/src/components/Team/AgentForm.jsx` | 源码 | 单个智能体配置表单（含 Copilot 警告提示） |
| `frontend/src/components/Task/TaskInput.jsx` | 源码 | 工作目录输入 + 任务描述输入 + 执行按钮 |
| `frontend/src/components/Task/MessageFeed.jsx` | 源码 | 任务执行消息流实时展示 |
| `frontend/src/components/Task/TaskProgress.jsx` | 源码 | 任务总体进度摘要（当前轮次、各智能体状态） |
| `frontend/src/components/History/HistoryList.jsx` | 源码 | 历史任务列表 |
| `frontend/src/components/History/HistoryViewer.jsx` | 源码 | 历史任务只读回放查看器 |
| `frontend/src/components/common/StatusBadge.jsx` | 源码 | 智能体状态标识组件（idle/working/error） |
| `frontend/src/components/common/TimeoutModal.jsx` | 源码 | 超时弹窗（继续等待/重试/中止） |
| `frontend/src/components/common/ConnectionStatus.jsx` | 源码 | 右上角 WebSocket 连接状态指示点 |

---

## 运行时生成文件（工作目录内）

> 以下文件由 ATO 运行时在用户的工作目录中自动生成，不属于项目源码。

| 文件路径 | 类型 | 说明 |
|---|---|---|
| `<workdir>/.agent-team` | 数据 | 团队配置文件（JSON），由应用自动管理 |
| `<workdir>/.agent-history/<task-id>.json` | 数据 | 单次任务完整执行记录（JSON），只读 |

---

*最后更新：2026-04-19*
