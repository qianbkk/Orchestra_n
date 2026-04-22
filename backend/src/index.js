// DONE: index.js
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { WebSocketServer } = require("ws");

const configManager = require("./configManager");
const historyManager = require("./historyManager");
const AgentManager = require("./agentManager");
const HealthChecker = require("./healthChecker");
const Scheduler = require("./scheduler");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.ATO_PORT || 3000);
const HOST = "127.0.0.1";

const agentManager = new AgentManager();
const healthChecker = new HealthChecker();
const scheduler = new Scheduler({ agentManager, historyManager, healthChecker });

function resolveWorkdir(workdir) {
  if (!workdir || typeof workdir !== "string") {
    throw new Error("workdir is required");
  }
  const resolved = path.resolve(workdir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`workdir does not exist: ${resolved}`);
  }
  return resolved;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

app.get("/api/config", (req, res) => {
  try {
    const workdir = resolveWorkdir(req.query.workdir);
    const config = configManager.loadConfig(workdir);
    return res.json({ ok: true, config });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/config", (req, res) => {
  try {
    const workdir = resolveWorkdir(req.body.workdir);
    configManager.saveConfig(workdir, req.body.config);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/history", (req, res) => {
  try {
    const workdir = resolveWorkdir(req.query.workdir);
    const tasks = historyManager.listTasks(workdir);
    return res.json({ ok: true, tasks });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/history/:taskId", (req, res) => {
  try {
    const workdir = resolveWorkdir(req.query.workdir);
    const task = historyManager.loadTask(workdir, req.params.taskId);
    return res.json({ ok: true, task });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/agents/status", (_req, res) => {
  return res.json({ ok: true, statuses: agentManager.getAllStatuses() });
});

app.post("/api/agents/:id/restart", (req, res) => {
  try {
    agentManager.restartAgent(req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/health", (_req, res) => {
  return res.json({ status: "ok" });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

healthChecker.start(agentManager, (agentId, secondsElapsed) => {
  const taskId = scheduler.getTaskByAgent(agentId);
  if (!taskId) return;
  broadcast({
    type: "TIMEOUT_ALERT",
    taskId,
    agentId,
    secondsElapsed,
  });
});

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "WS_CONNECTED" }));

  ws.on("message", async (raw) => {
    const message = safeJsonParse(raw.toString("utf8"));
    if (!message?.type) return;

    if (message.type === "RUN_TASK") {
      try {
        const workdir = resolveWorkdir(message.workdir);
        const config = configManager.loadConfig(workdir);
        if (!config) {
          throw new Error("No team config found. Please create team first.");
        }
        agentManager.init(config, workdir);
        scheduler
          .runTask(message.taskDesc, config, workdir, {
            onAgentMessage: (agentId, direction, content) => {
              broadcast({
                type: "AGENT_OUTPUT",
                agentId,
                taskId: scheduler.getTaskByAgent(agentId),
                content,
                direction,
              });
            },
            onDispatchParsed: (taskId, dispatch) => {
              broadcast({ type: "DISPATCH_EVENT", taskId, dispatch });
            },
            onAgentStatusChange: (agentId, status) => {
              broadcast({ type: "AGENT_STATUS", agentId, status });
            },
            onTaskProgress: (taskId, round, maxRounds) => {
              broadcast({ type: "TASK_PROGRESS", taskId, round, maxRounds });
            },
            onTaskComplete: (taskId, output) => {
              broadcast({ type: "TASK_COMPLETE", taskId, output });
            },
            onTaskError: (taskId, agentId, error) => {
              broadcast({ type: "TASK_ERROR", taskId, agentId, error });
            },
          })
          .catch((error) => {
            broadcast({
              type: "TASK_ERROR",
              taskId: null,
              agentId: null,
              error: String(error.message || error),
            });
          });
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "TASK_ERROR",
            taskId: null,
            agentId: null,
            error: String(error.message || error),
          }),
        );
      }
      return;
    }

    if (message.type === "TIMEOUT_RESPONSE") {
      const { taskId, agentId, action } = message;
      if (action === "wait") {
        healthChecker.setTimeoutOverride(agentId, 120);
        healthChecker.updateActivity(agentId);
      } else if (action === "retry") {
        scheduler.retrySubtask(taskId, agentId);
      } else if (action === "abort") {
        scheduler.abortTask(taskId);
      }
      return;
    }

    if (message.type === "ABORT_TASK") {
      scheduler.abortTask(message.taskId);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ATO backend listening at http://${HOST}:${PORT}`);
});
