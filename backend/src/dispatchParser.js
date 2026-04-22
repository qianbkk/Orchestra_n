// DONE: dispatchParser.js
const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  attributeNamePrefix: "",
});

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeTask(xmlTask) {
  return {
    agent: String(xmlTask.agent ?? "").trim(),
    mode: String(xmlTask.mode ?? "serial").trim().toLowerCase() === "parallel" ? "parallel" : "serial",
    id: String(xmlTask.id ?? "").trim(),
    content: typeof xmlTask["#text"] === "string" ? xmlTask["#text"].trim() : "",
  };
}

function parseDispatch(text) {
  const source = String(text ?? "");
  const blocks = [...source.matchAll(/<ato-dispatch>[\s\S]*?<\/ato-dispatch>/gi)];
  if (!blocks.length) {
    return null;
  }

  const allTasks = [];
  let timeoutSeconds = null;
  let collectAfterIds = null;

  for (const block of blocks) {
    try {
      const parsed = parser.parse(block[0]);
      const root = parsed["ato-dispatch"];
      const tasks = toArray(root?.task).map(normalizeTask).filter((item) => item.agent && item.id);
      allTasks.push(...tasks);

      if (root?.timeout?.seconds != null) {
        const nextTimeout = Number(root.timeout.seconds);
        if (Number.isFinite(nextTimeout)) {
          timeoutSeconds = nextTimeout;
        }
      }

      if (root?.["collect-after"]?.ids) {
        collectAfterIds = String(root["collect-after"].ids)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
      }
    } catch (error) {
      // 解析失败视为无分派
      console.warn("[dispatchParser] Failed to parse dispatch XML:", error.message);
      return null;
    }
  }

  const remainingText = source
    .replace(/<ato-dispatch>[\s\S]*?<\/ato-dispatch>/gi, "")
    .trim();

  return {
    tasks: allTasks,
    timeoutSeconds,
    collectAfterIds,
    remainingText,
  };
}

module.exports = {
  parseDispatch,
};
