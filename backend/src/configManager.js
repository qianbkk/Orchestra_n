// DONE: configManager.js
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILENAME = ".agent-team";
const COORDINATOR_PROMPT_INJECTION = `You are the coordinator agent. When you need to delegate subtasks to other agents,
output task assignments using ONLY this XML format:

<ato-dispatch>
  <task agent="EXACT_AGENT_NAME" mode="serial|parallel" id="UNIQUE_ID">
    Task description
  </task>
  <timeout seconds="N" />      <!-- optional: 30-1800 -->
  <collect-after ids="..." />  <!-- optional -->
</ato-dispatch>

Available agents: {AGENT_NAMES_LIST}
Use agent names exactly as listed. If no delegation needed, respond directly without XML.`;

function resolveConfigPath(workdir) {
  const resolvedWorkdir = path.resolve(workdir);
  return {
    resolvedWorkdir,
    configPath: path.join(resolvedWorkdir, CONFIG_FILENAME),
  };
}

function loadConfig(workdir) {
  const { configPath } = resolveConfigPath(workdir);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function buildInjectedPrompt(agentNames) {
  return COORDINATOR_PROMPT_INJECTION.replace(
    "{AGENT_NAMES_LIST}",
    agentNames.join(", "),
  );
}

function saveConfig(workdir, config) {
  const { resolvedWorkdir, configPath } = resolveConfigPath(workdir);
  const nextConfig = JSON.parse(JSON.stringify(config));
  nextConfig.workdir = resolvedWorkdir;
  nextConfig.updatedAt = new Date().toISOString();
  if (!nextConfig.createdAt) {
    nextConfig.createdAt = nextConfig.updatedAt;
  }

  const coordinator = nextConfig.agents.find(
    (agent) => agent.id === nextConfig.coordinatorId,
  );
  if (!coordinator) {
    throw new Error("Coordinator not found in agents list");
  }

  const agentNames = nextConfig.agents.map((agent) => agent.name);
  coordinator.systemPrompt = buildInjectedPrompt(agentNames);

  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
}

module.exports = {
  COORDINATOR_PROMPT_INJECTION,
  loadConfig,
  saveConfig,
};
