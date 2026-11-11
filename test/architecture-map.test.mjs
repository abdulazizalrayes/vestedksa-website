import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

test("architecture maps agree on components, flows and canonical source files", () => {
  const map = JSON.parse(readFileSync(new URL("../ARCHITECTURE.json", import.meta.url)));
  const html = readFileSync(new URL("../ARCHITECTURE.html", import.meta.url), "utf8");
  const start = html.indexOf("const components = [");
  const end = html.indexOf("const invariants = [", start);
  assert.ok(start >= 0 && end > start);
  const visual = vm.runInNewContext(html.slice(start, end) + ";({components,flows})", {}, { timeout: 1000 });
  for (const key of ["components", "flows"]) {
    assert.deepEqual(map[key].map(item => item.id).sort(), Array.from(visual[key], item => item.id).sort());
  }
  const ids = new Set(map.components.map(item => item.id));
  assert.equal(ids.size, map.components.length);
  for (const flow of map.flows) for (const step of flow.steps) {
    assert.ok(ids.has(step.from), step.from);
    assert.ok(ids.has(step.to), step.to);
  }
  for (const page of map.canonicalPages) {
    assert.ok(existsSync(new URL("../" + page.file, import.meta.url)), page.file);
  }
});
