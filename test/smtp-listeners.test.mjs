import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

for (const [file, reader] of [["lib/demand-mailer.cjs", "readResponse"], ["api/contact.js", "readSmtpResponse"]]) {
  const url = new URL(`../${file}`, import.meta.url);
  const context = { require: createRequire(url), module: { exports: {} }, process, Buffer, console, setTimeout, clearTimeout };
  vm.runInNewContext(`${readFileSync(url, "utf8")}\nmodule.exports.reader = ${reader};`, context);
  test(`${file}: repeated SMTP replies release temporary listeners`, async () => {
    const socket = new EventEmitter();
    for (let i = 0; i < 30; i++) {
      const pending = context.module.exports.reader(socket);
      socket.emit("data", Buffer.from("250 OK\r\n"));
      assert.equal(await pending, "250 OK\r\n");
      assert.equal(socket.listenerCount("error"), 0);
      assert.equal(socket.listenerCount("data"), 0);
    }
  });
  test(`${file}: SMTP failure releases data listeners`, async () => {
    const socket = new EventEmitter();
    const pending = context.module.exports.reader(socket);
    socket.emit("error", new Error("test failure"));
    await assert.rejects(pending, /test failure/);
    assert.equal(socket.listenerCount("data"), 0);
    assert.equal(socket.listenerCount("error"), 0);
  });
}
