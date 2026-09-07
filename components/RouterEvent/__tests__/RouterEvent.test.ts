import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { z } from "zod";

import { RouterEvent } from "../class.ts";

describe("RouterEvent", () => {
  test("exposes the configured name", () => {
    const event = new RouterEvent({ name: "greeting" });
    assert.equal(event.name, "greeting");
  });

  describe("validatePayload", () => {
    test("accepts a payload that matches the schema", () => {
      const event = new RouterEvent({
        name: "ping",
        payload: z.string(),
      });
      assert.doesNotThrow(() => event.validatePayload("hello"));
    });

    test("rejects a payload that fails schema parsing", () => {
      const event = new RouterEvent({
        name: "ping",
        payload: z.string(),
      });
      assert.throws(
        () => event.validatePayload(123),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes('Invalid payload for event "ping"'),
      );
    });

    test("with no schema, requires payload to be undefined", () => {
      const event = new RouterEvent({ name: "ready" });
      assert.doesNotThrow(() => event.validatePayload(undefined));
    });

    test("with no schema, rejects a non-undefined payload", () => {
      const event = new RouterEvent({ name: "ready" });
      assert.throws(
        () => event.validatePayload("nope"),
        (err: unknown) =>
          err instanceof TypeError &&
          err.message.includes('Payload must be undefined for event "ready"'),
      );
    });
  });
});
