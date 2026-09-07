import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { z } from "zod";

import { Router } from "../../../index.ts";
import { RouterAsyncMethod } from "../../RouterAsyncMethod/class.ts";
import { RouterEvent } from "../../RouterEvent/class.ts";
import { RouterMethod } from "../../RouterMethod/class.ts";

describe("Router", () => {
  describe("method invocation", () => {
    test("exposes registered methods as bound call functions", () => {
      const add = new RouterMethod({
        input: [z.number(), z.number()],
        output: z.number(),
        handler: (a, b) => a + b,
      });
      const router = new Router({ add });
      assert.equal(router.add(2, 3), 5);
    });

    test("exposes async methods returning a promise", async () => {
      const sleep = new RouterAsyncMethod({
        input: [z.number()],
        handler: async (ms) => {
          await new Promise((r) => setTimeout(r, ms));
        },
      });
      const router = new Router({ sleep });
      await router.sleep(1);
    });

    test("preserves the method's input and output types", () => {
      const add = new RouterMethod({
        input: [z.number(), z.number()],
        output: z.number(),
        handler: (a, b) => a + b,
      });
      const router = new Router({ add });
      const result: number = router.add(1, 2);
      assert.equal(result, 3);
    });
  });

  describe("sub-routers", () => {
    test("delegate calls to sub-router methods", () => {
      const sub = new Router({
        add: new RouterMethod({
          input: [z.number(), z.number()],
          output: z.number(),
          handler: (a, b) => a + b,
        }),
      });
      const root = new Router({ sub });
      assert.equal(root.sub.add(1, 2), 3);
    });

    test("expose sub-routers with their own typed shape", () => {
      const sub = new Router({
        greet: new RouterMethod({
          input: [z.string()],
          output: z.string(),
          handler: (name) => `hi ${name}`,
        }),
      });
      const root = new Router({ sub });
      const msg: string = root.sub.greet("world");
      assert.equal(msg, "hi world");
    });
  });

  describe("emit", () => {
    test("emits the user event with the parsed payload", () => {
      const greeting = new RouterEvent({
        name: "greeting",
        payload: z.string(),
      });
      const seen: unknown[] = [];
      const router = new Router({}, { event: [greeting] });
      router.on("greeting", (payload: unknown) => seen.push(payload));
      router.emit("greeting", "hello");
      assert.deepEqual(seen, ["hello"]);
    });

    test("throws when emitting an unknown event name", () => {
      const router = new Router({}, { event: [] });
      assert.throws(
        () => router.emit("missing", undefined),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes('Unknown event "missing"'),
      );
    });

    test("throws when the payload does not match the schema", () => {
      const event = new RouterEvent({
        name: "greeting",
        payload: z.string(),
      });
      const router = new Router({}, { event: [event] });
      assert.throws(
        () => router.emit("greeting", 123),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes('Invalid payload for event "greeting"'),
      );
    });

    test("throws when the payload is required but missing", () => {
      const event = new RouterEvent({
        name: "greeting",
        payload: z.string(),
      });
      const router = new Router({}, { event: [event] });
      assert.throws(
        () => router.emit("greeting"),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes('Invalid payload for event "greeting"'),
      );
    });

    test("allows omitting the payload when the schema is undefined-like", () => {
      const ready = new RouterEvent({ name: "ready" });
      const router = new Router({}, { event: [ready] });
      assert.doesNotThrow(() => router.emit("ready"));
    });
  });

  describe("log / bubble", () => {
    test("logger receives method bubbles (called + returned)", () => {
      const seen: unknown[] = [];
      const add = new RouterMethod({
        input: [z.number(), z.number()],
        output: z.number(),
        handler: (a, b) => a + b,
      });
      const router = new Router(
        { add },
        { logger: (payload) => seen.push(payload) },
      );
      router.add(1, 2);
      assert.equal(seen.length, 2);
      assert.equal((seen[0] as { type: string }).type, "methodCalled");
      assert.equal((seen[1] as { type: string }).type, "methodReturned");
    });

    test("logFilter returning false skips logging", () => {
      const seen: unknown[] = [];
      const router = new Router(
        {
          m: new RouterMethod({
            input: [z.number()],
            handler: () => undefined,
          }),
        },
        {
          logFilter: (payload) => {
            seen.push(payload);
            return false;
          },
          logger: () => {
            throw new Error("logger should not be called");
          },
        },
      );
      router.m(1);
      assert.equal(seen.length, 2);
    });

    test("bubbleFilter false still invokes the logger (it only controls the internal fan-out)", () => {
      const seen: unknown[] = [];
      const router = new Router(
        {
          m: new RouterMethod({
            input: [z.number()],
            handler: () => undefined,
          }),
        },
        {
          bubbleFilter: false,
          logger: (payload) => seen.push(payload),
        },
      );
      router.m(1);
      assert.equal(seen.length, 2);
    });

    test("sub-router bubbles are prefixed with the sub-router key", () => {
      const seen: unknown[] = [];
      const sub = new Router(
        {
          m: new RouterMethod({
            input: [z.number()],
            handler: () => undefined,
          }),
        },
        { bubbleFilter: true },
      );
      const root = new Router(
        { sub },
        {
          bubbleFilter: true,
          logger: (payload) => seen.push(payload),
        },
      );
      sub.m(1);
      assert.equal(seen.length, 2);
      assert.deepEqual((seen[0] as { path: string[] }).path, ["sub", "m"]);
    });

    test("nested sub-routers accumulate the path", () => {
      const seen: unknown[] = [];
      const inner = new Router({
        m: new RouterMethod({
          input: [z.number()],
          handler: () => undefined,
        }),
      });
      const mid = new Router({ inner });
      const root = new Router(
        { mid },
        { logger: (payload) => seen.push(payload) },
      );
      inner.m(1);
      assert.deepEqual((seen[0] as { path: string[] }).path, [
        "mid",
        "inner",
        "m",
      ]);
    });
  });
});
