// DONE: healthChecker.js
class HealthChecker {
  constructor() {
    this.timer = null;
    this.agentManager = null;
    this.onTimeout = null;
    this.timeoutOverrides = new Map();
    this.lastActivities = new Map();
    this.alertedAgents = new Set();
    this.defaultTimeoutSeconds = 120;
  }

  start(agentManager, onTimeout) {
    this.stop();
    this.agentManager = agentManager;
    this.onTimeout = onTimeout;
    this.timer = setInterval(() => {
      const statuses = this.agentManager.getAllStatuses();
      for (const [agentId, status] of Object.entries(statuses)) {
        if (status.state !== "working") {
          this.alertedAgents.delete(agentId);
          continue;
        }

        const lastActivity =
          this.lastActivities.get(agentId) || new Date(status.lastActivity || Date.now());
        const elapsedSeconds = Math.floor((Date.now() - lastActivity.getTime()) / 1000);
        const timeoutSeconds = this.timeoutOverrides.get(agentId) ?? this.defaultTimeoutSeconds;

        if (elapsedSeconds >= timeoutSeconds && !this.alertedAgents.has(agentId)) {
          this.alertedAgents.add(agentId);
          this.onTimeout?.(agentId, elapsedSeconds);
        }
      }
    }, 15_000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = null;
    this.alertedAgents.clear();
  }

  updateActivity(agentId) {
    this.lastActivities.set(agentId, new Date());
    this.alertedAgents.delete(agentId);
  }

  setTimeoutOverride(agentId, seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return;
    this.timeoutOverrides.set(agentId, Math.max(30, Math.min(1800, Math.floor(value))));
  }
}

module.exports = HealthChecker;
