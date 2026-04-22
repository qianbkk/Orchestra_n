// DONE: adapters/base.js
class CLINotAvailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "CLINotAvailableError";
  }
}

/**
 * @interface CLIAdapter
 */
class CLIAdapter {
  constructor(agent, workdir) {
    this.agent = agent;
    this.workdir = workdir;
    this._sessionId = null;
    this._activeProcess = null;
  }

  async sendMessage(_message, _onChunk) {
    throw new Error("Not implemented");
  }

  async checkAvailable() {
    throw new Error("Not implemented");
  }

  getSessionId() {
    return this._sessionId;
  }

  clearSession() {
    this._sessionId = null;
  }

  setActiveProcess(child) {
    this._activeProcess = child;
  }

  killActiveProcess() {
    if (this._activeProcess && !this._activeProcess.killed) {
      this._activeProcess.kill("SIGTERM");
    }
    this._activeProcess = null;
  }
}

module.exports = {
  CLIAdapter,
  CLINotAvailableError,
};
