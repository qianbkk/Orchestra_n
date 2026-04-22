// DONE: scheduler.js
const { parseDispatch } = require("./dispatchParser");

const MAX_DISPATCH_ROUNDS = 10;

class Scheduler {
  constructor({ agentManager, historyManager, healthChecker }) {
    this.agentManager = agentManager;
    this.historyManager = historyManager;
    this.healthChecker = healthChecker;
    this.activeTasks = new Map();
    this.agentTaskMap = new Map();
  }

  getTaskByAgent(agentId) {
    return this.agentTaskMap.get(agentId) || null;
  }

  abortTask(taskId) {
    const taskState = this.activeTasks.get(taskId);
    if (!taskState) return;
    taskState.aborted = true;
    this.agentManager.stopAllActiveProcesses();
  }

  retrySubtask(taskId, agentId) {
    const taskState = this.activeTasks.get(taskId);
    if (!taskState) return;
    taskState.retryAgents.add(agentId);
    this.agentManager.getAdapter(agentId).killActiveProcess();
  }

  extendTimeout(taskId, agentId, seconds) {
    if (!this.activeTasks.has(taskId)) return;
    this.healthChecker.setTimeoutOverride(agentId, seconds);
    this.healthChecker.updateActivity(agentId);
  }

  async executeAgentMessage(taskState, taskRecord, agent, message, callbacks, logType = "send") {
    const adapter = this.agentManager.getAdapter(agent.id);
    this.agentManager.setWorking(agent.id);
    callbacks.onAgentStatusChange?.(agent.id, this.agentManager.getStatus(agent.id));
    this.historyManager.appendLog(
      taskState.workdir,
      taskRecord.id,
      agent.id,
      agent.name,
      logType,
      message,
    );
    callbacks.onAgentMessage?.(agent.id, "send", message);
    this.healthChecker.updateActivity(agent.id);
    this.agentTaskMap.set(agent.id, taskRecord.id);

    const trySend = async () => {
      const output = await adapter.sendMessage(message, (chunk) => {
        callbacks.onAgentMessage?.(agent.id, "receive", chunk);
        this.historyManager.appendLog(
          taskState.workdir,
          taskRecord.id,
          agent.id,
          agent.name,
          "receive",
          chunk,
        );
        this.healthChecker.updateActivity(agent.id);
        this.agentManager.touch(agent.id);
      });
      return output;
    };

    let attempts = 0;
    while (attempts < 2) {
      try {
        const result = await trySend();
        this.agentManager.setIdle(agent.id);
        callbacks.onAgentStatusChange?.(agent.id, this.agentManager.getStatus(agent.id));
        this.agentTaskMap.delete(agent.id);
        return result;
      } catch (error) {
        const shouldRetry = taskState.retryAgents.has(agent.id);
        if (shouldRetry && attempts === 0) {
          taskState.retryAgents.delete(agent.id);
          attempts += 1;
          this.healthChecker.updateActivity(agent.id);
          continue;
        }
        this.agentManager.setError(agent.id, error);
        callbacks.onAgentStatusChange?.(agent.id, this.agentManager.getStatus(agent.id));
        this.historyManager.appendLog(
          taskState.workdir,
          taskRecord.id,
          agent.id,
          agent.name,
          "error",
          String(error.message || error),
        );
        callbacks.onError?.(agent.id, error);
        this.agentTaskMap.delete(agent.id);
        throw error;
      }
    }

    throw new Error("Unreachable");
  }

  async runTask(taskDesc, teamConfig, workdir, callbacks = {}) {
    const taskRecord = this.historyManager.createTask(workdir, taskDesc);
    const taskState = {
      id: taskRecord.id,
      workdir,
      aborted: false,
      retryAgents: new Set(),
    };
    this.activeTasks.set(taskRecord.id, taskState);

    try {
      const coordinator = teamConfig.agents.find((item) => item.id === teamConfig.coordinatorId);
      if (!coordinator) {
        throw new Error("Coordinator not found");
      }

      let round = 0;
      let coordinatorInput = `${taskDesc}\n\nTeam成员：${teamConfig.agents
        .map((a) => `${a.name}(${a.role})`)
        .join("，")}`;

      while (round < MAX_DISPATCH_ROUNDS) {
        if (taskState.aborted) {
          throw new Error("Task aborted");
        }
        round += 1;
        callbacks.onLog?.("info", `Round ${round}/${MAX_DISPATCH_ROUNDS}`);
        callbacks.onTaskProgress?.(taskRecord.id, round, MAX_DISPATCH_ROUNDS);

        const coordinatorOutput = await this.executeAgentMessage(
          taskState,
          taskRecord,
          coordinator,
          coordinatorInput,
          callbacks,
          "send",
        );

        const dispatch = parseDispatch(coordinatorOutput);
        if (!dispatch || !dispatch.tasks.length) {
          this.historyManager.finalizeTask(workdir, taskRecord.id, coordinatorOutput, "completed");
          callbacks.onTaskComplete?.(taskRecord.id, coordinatorOutput);
          this.activeTasks.delete(taskRecord.id);
          return { taskId: taskRecord.id, output: coordinatorOutput };
        }

        if (dispatch.timeoutSeconds != null) {
          for (const agent of teamConfig.agents) {
            this.healthChecker.setTimeoutOverride(agent.id, dispatch.timeoutSeconds);
          }
        }

        this.historyManager.appendLog(
          workdir,
          taskRecord.id,
          coordinator.id,
          coordinator.name,
          "dispatch",
          JSON.stringify(dispatch, null, 2),
        );
        callbacks.onDispatchParsed?.(taskRecord.id, dispatch);

        const serialTasks = dispatch.tasks.filter((task) => task.mode === "serial");
        const parallelTasks = dispatch.tasks.filter((task) => task.mode === "parallel");
        const outputs = [];

        for (const task of serialTasks) {
          if (taskState.aborted) throw new Error("Task aborted");
          const agent = teamConfig.agents.find(
            (item) => item.name.trim().toLowerCase() === task.agent.trim().toLowerCase(),
          );
          if (!agent) {
            outputs.push(`来自${task.agent}的结果：\n[ERROR] Agent not found`);
            continue;
          }
          const result = await this.executeAgentMessage(
            taskState,
            taskRecord,
            agent,
            task.content,
            callbacks,
            "send",
          );
          outputs.push(`来自${agent.name}的结果：\n${result}`);
        }

        if (parallelTasks.length) {
          const parallelResults = await Promise.all(
            parallelTasks.map(async (task) => {
              const agent = teamConfig.agents.find(
                (item) => item.name.trim().toLowerCase() === task.agent.trim().toLowerCase(),
              );
              if (!agent) {
                return `来自${task.agent}的结果：\n[ERROR] Agent not found`;
              }
              const result = await this.executeAgentMessage(
                taskState,
                taskRecord,
                agent,
                task.content,
                callbacks,
                "send",
              );
              return `来自${agent.name}的结果：\n${result}`;
            }),
          );
          outputs.push(...parallelResults);
        }

        coordinatorInput = outputs.join("\n---\n");
      }

      const fallback = "已达到最大分派轮次，返回当前已收集输出。";
      this.historyManager.finalizeTask(workdir, taskRecord.id, fallback, "completed");
      callbacks.onTaskComplete?.(taskRecord.id, fallback);
      this.activeTasks.delete(taskRecord.id);
      return { taskId: taskRecord.id, output: fallback };
    } catch (error) {
      const status = String(error.message || "").includes("aborted") ? "aborted" : "failed";
      this.historyManager.finalizeTask(workdir, taskRecord.id, null, status);
      callbacks.onTaskError?.(taskRecord.id, null, String(error.message || error));
      this.activeTasks.delete(taskRecord.id);
      throw error;
    }
  }
}

module.exports = Scheduler;
