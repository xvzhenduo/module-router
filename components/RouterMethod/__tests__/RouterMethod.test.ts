import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { z } from "zod";

import { RouterMethod } from "../class.ts";

describe("RouterMethod", () => {
  describe("call", () => {
    test("returns the handler's result", () => {
      const add = new RouterMethod({
        input: [z.number(), z.number()],
        output: z.number(),
        handler: (a, b) => a + b,
      });
      assert.equal(add.call(2, 3), 5);
    });

    test("emits 'called' then 'returned' in order", () => {
      const order: string[] = [];
      const m = new RouterMethod({
        input: [z.number()],
        output: z.number(),
        handler: (n) => {
          order.push("handler");
          return n * 2;
        },
      });
      m.on("called", () => order.push("called"));
      m.on("returned", () => order.push("returned"));

      const result = m.call(4);
      assert.equal(result, 8);
      assert.deepEqual(order, ["called", "handler", "returned"]);
    });

    test("emits 'errored' and rethrows when the handler throws", () => {
      const order: string[] = [];
      const m = new RouterMethod({
        input: [z.number()],
        handler: (n) => {
          if (n < 0) {
            throw new Error("negative");
          }
          return n;
        },
      });
      m.on("called", () => order.push("called"));
      m.on("errored", () => order.push("errored"));

      assert.throws(() => m.call(-1), /negative/);
      assert.deepEqual(order, ["called", "errored"]);
    });

    test("throws when the input arity does not match the schema", () => {
      const m = new RouterMethod({
        input: [z.number(), z.number()],
        handler: () => 0,
      });
      assert.throws(
        () => m.call(1),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes("Expected 2 argument(s)"),
      );
    });

    test("throws when an input value fails schema parsing", () => {
      const m = new RouterMethod({
        input: [z.string()],
        handler: () => 0,
      });
      assert.throws(
        () => m.call(123 as unknown as string),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes("Invalid argument at index 0"),
      );
    });

    test("throws when the handler's return value fails output schema", () => {
      const m = new RouterMethod({
        input: [z.number()],
        output: z.number(),
        handler: () => "not a number" as unknown as number,
      });
      assert.throws(
        () => m.call(1),
        (err: unknown) =>
          err instanceof TypeError && err.message.startsWith("Invalid output:"),
      );
    });

    test("validates arity even when input and output schemas are omitted", () => {
      const m = new RouterMethod({
        handler: () => undefined,
      });
      assert.throws(
        () => m.call(1),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes("Expected 0 argument"),
      );
    });
  });

  describe("typed event payload", () => {
    test("'called' listener receives the parsed input tuple", () => {
      const m = new RouterMethod({
        input: [z.number(), z.string()],
        output: z.number(),
        handler: () => 0,
      });
      const seen: unknown[] = [];
      m.on("called", (data) => seen.push(data.input));
      m.call(7, "hi");
      assert.deepEqual(seen, [[7, "hi"]]);
    });

    test("'returned' listener receives both input and output", () => {
      const m = new RouterMethod({
        input: [z.number()],
        output: z.number(),
        handler: (n) => n + 1,
      });
      const seen: unknown[] = [];
      m.on("returned", (data) => seen.push(data));
      m.call(10);
      assert.deepEqual(seen, [{ input: [10], output: 11 }]);
    });
  });
});
