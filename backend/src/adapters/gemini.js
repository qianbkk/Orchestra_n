// DONE: adapters/gemini.js
const { spawn, spawnSync } = require("node:child_process");
const { CLIAdapter, CLINotAvailableError } = require("./base");

function detectSessionFlags() {
  const help = spawnSync("gemini", ["--help"], { encoding: "utf8" });
  const output = `${help.stdout || ""}\n${help.stderr || ""}`;
  if (output.includes("--session")) return ["--session"];
  if (output.includes("-c")) return ["-c"];
  return null;
}

class GeminiAdapter extends CLIAdapter {
  constructor(agent, workdir) {
    super(agent, workdir);
    this.sessionFlag = undefined;
  }

  async checkAvailable() {
    const result = spawnSync("gemini", ["--version"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new CLINotAvailableError(
        "Gemini CLI 不可用。请先安装并确保 `gemini --version` 可执行。",
      );
    }
    return true;
  }

  async sendMessage(message, onChunk) {
    await this.checkAvailable();
    if (this.sessionFlag === undefined) {
      this.sessionFlag = detectSessionFlags();
    }

    const args = this.sessionFlag ? [...this.sessionFlag] : ["-p", message];
    return new Promise((resolve, reject) => {
      const child = spawn("gemini", args, {
        cwd: this.workdir,
        env: { ...process.env },
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
        if (signal) return reject(new Error(`Gemini process terminated: ${signal}`));
        if (code !== 0) return reject(new Error(errorText || `Gemini exited with code ${code}`));
        return resolve(output.trim());
      });

      if (this.sessionFlag) {
        child.stdin.write(message);
        child.stdin.end();
      }
    });
  }
}

module.exports = GeminiAdapter;
