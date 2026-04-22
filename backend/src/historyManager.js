// DONE: historyManager.js
const fs = require("node:fs");
const path = require("node:path");
const { v4: uuidv4 } = require("uuid");

function getHistoryDir(workdir) {
  return path.join(path.resolve(workdir), ".agent-history");
}

function getTaskFilePath(workdir, taskId) {
  return path.join(getHistoryDir(workdir), `${taskId}.json`);
}

function ensureHistoryDir(workdir) {
  fs.mkdirSync(getHistoryDir(workdir), { recursive: true });
}

function createTask(workdir, taskDesc) {
  ensureHistoryDir(workdir);
  const record = {
    id: uuidv4(),
    description: taskDesc,
    status: "running",
    createdAt: new Date().toISOString(),
    completedAt: null,
    finalOutput: null,
    logs: [],
  };
  fs.writeFileSync(
    getTaskFilePath(workdir, record.id),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  return record;
}

function loadTask(workdir, taskId) {
  const taskPath = getTaskFilePath(workdir, taskId);
  if (!fs.existsSync(taskPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(taskPath, "utf8"));
}

function saveTask(workdir, task) {
  fs.writeFileSync(
    getTaskFilePath(workdir, task.id),
    `${JSON.stringify(task, null, 2)}\n`,
    "utf8",
  );
}

function appendLog(workdir, taskId, agentId, agentName, type, content) {
  const task = loadTask(workdir, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  task.logs.push({
    ts: new Date().toISOString(),
    agentId,
    agentName,
    type,
    content,
  });
  saveTask(workdir, task);
}

function finalizeTask(workdir, taskId, finalOutput, status) {
  const task = loadTask(workdir, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  task.status = status;
  task.finalOutput = finalOutput ?? null;
  task.completedAt = new Date().toISOString();
  saveTask(workdir, task);
}

function listTasks(workdir) {
  ensureHistoryDir(workdir);
  const files = fs
    .readdirSync(getHistoryDir(workdir))
    .filter((filename) => filename.endsWith(".json"));
  const tasks = files
    .map((filename) => {
      const payload = JSON.parse(
        fs.readFileSync(path.join(getHistoryDir(workdir), filename), "utf8"),
      );
      return {
        id: payload.id,
        description: payload.description,
        status: payload.status,
        createdAt: payload.createdAt,
        completedAt: payload.completedAt,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return tasks;
}

module.exports = {
  appendLog,
  createTask,
  finalizeTask,
  listTasks,
  loadTask,
};
