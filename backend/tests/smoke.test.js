const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDispatch } = require("../src/dispatchParser");

test("parseDispatch parses a basic XML dispatch block", () => {
  const input = `
  before
  <ato-dispatch>
    <task agent="Developer" mode="serial" id="t1">Do A</task>
    <timeout seconds="300" />
  </ato-dispatch>
  after
  `;
  const result = parseDispatch(input);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].agent, "Developer");
  assert.equal(result.timeoutSeconds, 300);
  assert.equal(result.remainingText.includes("before"), true);
});
