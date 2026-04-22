// DONE: adapters/copilot.js
const { spawn, spawnSync } = require("node:child_process");
const { CLIAdapter, CLINotAvailableError } = require("./base");

class CopilotAdapter extends CLIAdapter {
  async checkAvailable() {
    const result = spawnSync("gh", ["copilot", "--version"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new CLINotAvailableError(
        "GitHub Copilot CLI 不可用。请先安装并确保 `gh copilot --version` 可执行。",
      );
    }
    return true;
  }

  async sendMessage(message, onChunk) {
    await this.checkAvailable();
    return new Promise((resolve, reject) => {
      const args = ["copilot", "suggest", "-t", "shell", message];
      const child = spawn("gh", args, {
        cwd: this.workdir,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
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
        if (signal) return reject(new Error(`Copilot process terminated: ${signal}`));
        if (code !== 0) return reject(new Error(errorText || `Copilot exited with code ${code}`));

        const warning =
          "⚠️ Copilot CLI 主要面向命令建议，用于通用对话任务时效果可能有限。\n";
        return resolve(`${warning}${output.trim()}`);
      });
    });
  }
}

module.exports = CopilotAdapter;
