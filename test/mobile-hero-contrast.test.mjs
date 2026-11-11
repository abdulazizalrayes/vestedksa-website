import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mobile hero retains a dark overlay behind white text", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const mobile = html.slice(html.indexOf("@media (max-width: 767px)"));
  assert.ok(mobile.includes("rgba(0, 0, 0, 0.88) 0%"));
  assert.ok(mobile.includes("rgba(0, 0, 0, 0.82) 100%"));
  assert.ok(!mobile.includes("rgba(255, 255, 255, 0.98)"));
});
