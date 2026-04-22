// DONE: agentManager.js
const path = require("node:path");
const ClaudeCodeAdapter = require("./adapters/claudeCode");
const GeminiAdapter = require("./adapters/gemini");
const CodexAdapter = require("./adapters/codex");
const CopilotAdapter = require("./adapters/copilot");

const ADAPTER_MAP = {
  "claude-code": ClaudeCodeAdapter,
  gemini: GeminiAdapter,
  codex: CodexAdapter,
  copilot: CopilotAdapter,
};

class AgentManager {
  constructor() {
    this.adapters = new Map();
    this.statuses = new Map();
    this.teamConfig = null;
    this.workdir = null;
  }

  init(teamConfig, workdir) {
    this.teamConfig = teamConfig;
    this.workdir = path.resolve(workdir);
    this.adapters.clear();
    this.statuses.clear();

    for (const agent of teamConfig.agents) {
      const Adapter = ADAPTER_MAP[agent.cli];
      if (!Adapter) {
        throw new Error(`Unsupported CLI adapter: ${agent.cli}`);
      }
      this.adapters.set(agent.id, new Adapter(agent, this.workdir));
      this.statuses.set(agent.id, {
        state: "idle",
        lastActivity: new Date(),
        error: null,
      });
    }
  }

  getAdapter(agentId) {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`Adapter not found for agent ${agentId}`);
    }
    return adapter;
  }

  getStatus(agentId) {
    const status = this.statuses.get(agentId);
    if (!status) {
      throw new Error(`Status not found for agent ${agentId}`);
    }
    return status;
  }

  touch(agentId) {
    const status = this.getStatus(agentId);
    status.lastActivity = new Date();
  }

  setWorking(agentId) {
    const status = this.getStatus(agentId);
    status.state = "working";
    status.error = null;
    status.lastActivity = new Date();
  }

  setIdle(agentId) {
    const status = this.getStatus(agentId);
    status.state = "idle";
    status.error = null;
    status.lastActivity = new Date();
  }

  setError(agentId, error) {
    const status = this.getStatus(agentId);
    status.state = "error";
    status.error = String(error?.message || error || "Unknown error");
    status.lastActivity = new Date();
  }

  restartAgent(agentId) {
    const agent = this.teamConfig.agents.find((item) => item.id === agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    const Adapter = ADAPTER_MAP[agent.cli];
    this.adapters.set(agent.id, new Adapter(agent, this.workdir));
    this.statuses.set(agent.id, {
      state: "idle",
      lastActivity: new Date(),
      error: null,
    });
  }

  getAllStatuses() {
    const result = {};
    for (const [id, status] of this.statuses.entries()) {
      result[id] = { ...status };
    }
    return result;
  }

  stopAllActiveProcesses() {
    for (const adapter of this.adapters.values()) {
      adapter.killActiveProcess();
    }
  }
}

module.exports = AgentManager;
