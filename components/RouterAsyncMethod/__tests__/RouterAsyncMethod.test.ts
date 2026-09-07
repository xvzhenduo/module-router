import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { z } from "zod";

import { RouterAsyncMethod } from "../class.ts";

describe("RouterAsyncMethod", () => {
  describe("call", () => {
    test("resolves with the handler's result", async () => {
      const fetch = new RouterAsyncMethod({
        input: [z.string()],
        output: z.string(),
        handler: async (url) => `fetched:${url}`,
      });
      const result = await fetch.call("/api");
      assert.equal(result, "fetched:/api");
    });

    test("emits 'called' before the handler runs and 'returned' after", async () => {
      const order: string[] = [];
      const sleep = new RouterAsyncMethod({
        input: [z.number()],
        handler: async (ms) => {
          await new Promise((r) => setTimeout(r, ms));
          order.push("handler");
        },
      });
      sleep.on("called", () => order.push("called"));
      sleep.on("returned", () => order.push("returned"));

      await sleep.call(1);
      assert.deepEqual(order, ["called", "handler", "returned"]);
    });

    test("emits 'errored' and rejects when the handler rejects", async () => {
      const order: string[] = [];
      const fail = new RouterAsyncMethod({
        handler: async () => {
          throw new Error("boom");
        },
      });
      fail.on("called", () => order.push("called"));
      fail.on("errored", () => order.push("errored"));

      await assert.rejects(fail.call(), /boom/);
      assert.deepEqual(order, ["called", "errored"]);
    });

    test("throws synchronously when input arity does not match", async () => {
      const m = new RouterAsyncMethod({
        input: [z.number(), z.number()],
        handler: async () => 0,
      });
      await assert.rejects(
        m.call(1),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes("Expected 2 argument"),
      );
    });

    test("throws when an input value fails schema parsing", async () => {
      const m = new RouterAsyncMethod({
        input: [z.string()],
        handler: async () => undefined,
      });
      await assert.rejects(
        m.call(123 as unknown as string),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes("Invalid argument at index 0"),
      );
    });

    test("rejects when the resolved value fails the output schema", async () => {
      const m = new RouterAsyncMethod({
        input: [z.number()],
        output: z.number(),
        handler: async () => "not a number",
      });
      await assert.rejects(
        m.call(1),
        (err: unknown) =>
          err instanceof TypeError && err.message.startsWith("Invalid output:"),
      );
    });
  });

  describe("typed event payload", () => {
    test("'returned' listener receives input and resolved output", async () => {
      const m = new RouterAsyncMethod({
        input: [z.number()],
        output: z.number(),
        handler: async (n) => n * 2,
      });
      const seen: unknown[] = [];
      m.on("returned", (data) => seen.push(data));
      await m.call(5);
      assert.deepEqual(seen, [{ input: [5], output: 10 }]);
    });
  });
});
