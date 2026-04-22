// DONE: adapters/claudeCode.js
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { CLIAdapter, CLINotAvailableError } = require("./base");

function detectContinueSupport() {
  const help = spawnSync("claude", ["--help"], { encoding: "utf8" });
  const output = `${help.stdout || ""}\n${help.stderr || ""}`;
  return output.includes("--continue") || output.includes("-c");
}

function getClaudeCandidates() {
  const result = spawnSync("where", ["claude"], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickRealClaudePath() {
  const candidates = getClaudeCandidates();
  const real = candidates.find((item) => !item.toLowerCase().includes("claude_launcher"));
  return real || "claude";
}

function findLauncherDir() {
  const fromEnv = process.env.CLAUDE_LAUNCHER_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  const candidates = getClaudeCandidates();
  const launcherPath = candidates.find((item) => item.toLowerCase().includes("claude_launcher"));
  if (launcherPath) {
    return path.dirname(launcherPath);
  }

  const fallback = "D:\\Claude_launcher";
  if (fs.existsSync(fallback)) {
    return fallback;
  }
  return null;
}

function loadLauncherSelectionEnv() {
  const launcherDir = findLauncherDir();
  if (!launcherDir) {
    return null;
  }
  const selectionPath = path.join(launcherDir, "last_selection.json");
  if (!fs.existsSync(selectionPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(selectionPath, "utf8").replace(/^\uFEFF/, "");
    const data = JSON.parse(raw);
    if (!data.base_url || !data.api_key || !data.model) {
      return null;
    }
    const fastModel = data.fast_model || data.model;
    return {
      ANTHROPIC_BASE_URL: data.base_url,
      ANTHROPIC_AUTH_TOKEN: data.api_key,
      ANTHROPIC_MODEL: data.model,
      ANTHROPIC_SMALL_FAST_MODEL: fastModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: data.model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: data.model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: fastModel,
      ANTHROPIC_API_KEY: data.anthropic_mode ? data.api_key : "",
      CLAUDE_LAUNCHER_ACTIVE: "1",
    };
  } catch {
    return null;
  }
}

class ClaudeCodeAdapter extends CLIAdapter {
  constructor(agent, workdir) {
    super(agent, workdir);
    this.supportsContinue = null;
  }

  async checkAvailable() {
    const result = spawnSync("claude", ["--version"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new CLINotAvailableError(
        "Claude Code CLI 不可用。请先安装并确保 `claude --version` 可执行。",
      );
    }
    return true;
  }

  async sendMessage(message, onChunk) {
    await this.checkAvailable();
    if (this.supportsContinue == null) {
      this.supportsContinue = detectContinueSupport();
    }

    const runClaude = (binary, args, writeInput, extraEnv = {}) =>
      new Promise((resolve, reject) => {
        const child = spawn(binary, args, {
          cwd: this.workdir,
          env: { ...process.env, ...extraEnv },
          stdio: ["pipe", "pipe", "pipe"],
        });
        this.setActiveProcess(child);
        let output = "";
        let errorText = "";
        const timer = setTimeout(() => {
          child.kill("SIGTERM");
        }, 600_000);

        child.stdout.on("data", (chunk) => {
          const text = chunk.toString("utf8");
          output += text;
          onChunk?.(text);
        });

        child.stderr.on("data", (chunk) => {
          const text = chunk.toString("utf8");
          errorText += text;
          onChunk?.(text);
        });

        child.on("error", (error) => {
          clearTimeout(timer);
          this.killActiveProcess();
          reject(error);
        });

        child.on("close", (code, signal) => {
          clearTimeout(timer);
          this.killActiveProcess();
          if (signal) {
            return reject(new Error(`Claude process terminated: ${signal}`));
          }
          if (code !== 0) {
            return reject(new Error(errorText || output || `Claude exited with code ${code}`));
          }
          return resolve(output.trim());
        });

        if (writeInput) {
          child.stdin.write(message);
        }
        child.stdin.end();
      });

    // 1) 默认路径：沿用项目原设定（continue 会话）
    const defaultArgs = this.supportsContinue
      ? ["--dangerously-skip-permissions", "-c"]
      : ["--dangerously-skip-permissions", "-p", message];
    const realClaude = pickRealClaudePath();

    try {
      return await runClaude("claude", defaultArgs, this.supportsContinue);
    } catch (firstError) {
      const text = String(firstError?.message || "");
      const loginLikeError =
        text.includes("Not logged in") || text.includes("/login") || text.includes("No previous selection found");

      if (!loginLikeError) {
        throw firstError;
      }

      // 2) launcher 兼容回退：读取 last_selection 注入环境，并直接调用真实 claude 二进制
      // 避免 `--resume` + `--print` 冲突。
      const launcherEnv = loadLauncherSelectionEnv();
      if (!launcherEnv) {
        throw firstError;
      }
      return runClaude(realClaude, defaultArgs, this.supportsContinue, launcherEnv);
    }
  }
}

module.exports = ClaudeCodeAdapter;
