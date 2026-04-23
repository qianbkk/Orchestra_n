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
    const bytes = fs.readFileSync(selectionPath);
    let raw = bytes.toString("utf8").replace(/^\uFEFF/, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      raw = bytes.toString("utf16le").replace(/^\uFEFF/, "");
      data = JSON.parse(raw);
    }
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
    this._launcherEnv = undefined;
  }

  _getLauncherEnv() {
    if (this._launcherEnv === undefined) {
      this._launcherEnv = loadLauncherSelectionEnv();
    }
    return this._launcherEnv;
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
        let settled = false;
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
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.killActiveProcess();
          reject(error);
        });

        child.on("close", (code, signal) => {
          if (settled) return;
          settled = true;
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
    const launcherEnv = this._getLauncherEnv();

    // 优先：如果已有 launcher 上次选择，直接注入环境并调用真实 claude（绕过菜单）
    if (launcherEnv) {
      try {
        return await runClaude(realClaude, defaultArgs, this.supportsContinue, launcherEnv);
      } catch (error) {
        const text = String(error?.message || "");
        const authLike = text.includes("Not logged in") || text.includes("/login") || text.includes("Unauthorized");
        if (!authLike) {
          throw error;
        }
      }
    }

    try {
      // 无 last_selection 时仍尝试直连，但强制 launcher 守卫，避免菜单阻塞
      return await runClaude("claude", defaultArgs, this.supportsContinue, {
        CLAUDE_LAUNCHER_ACTIVE: "1",
      });
    } catch (firstError) {
      const text = String(firstError?.message || "");
      const loginLikeError =
        text.includes("Not logged in") ||
        text.includes("/login") ||
        text.includes("No previous selection found") ||
        text.includes("Unauthorized") ||
        text.includes("401");

      if (!loginLikeError) {
        throw firstError;
      }

      // 回退：用户可能刚手工走过菜单，刷新 last_selection 后重试
      this._launcherEnv = loadLauncherSelectionEnv();
      const refreshed = this._launcherEnv;
      if (!refreshed) {
        throw new CLINotAvailableError(
          "Claude launcher 未就绪。请先在终端手动运行一次 claude 并选择菜单项，再重试任务。",
        );
      }
      return runClaude(realClaude, defaultArgs, this.supportsContinue, refreshed);
    }
  }
}

module.exports = ClaudeCodeAdapter;
