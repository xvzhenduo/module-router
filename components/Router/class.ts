import { EventEmitter } from "node:events";

import type { z } from "zod";

import type { RouterAsyncMethod } from "../RouterAsyncMethod/class.ts";
import type { RouterEvent } from "../RouterEvent/class.ts";
import type { RouterMethod } from "../RouterMethod/class.ts";
import type { InferInputs } from "../RouterMethod/types.ts";

const LOG_EVENT = Symbol("router.log");

// `any` is used to keep the constraint's element type invariant only in
// `any`, which lets TS infer the specific tuple elements from constructor args.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyMethod = RouterMethod<any, any> | RouterAsyncMethod<any, any>;
type AnyEvent = RouterEvent<any, any>;
type AnyEventTuple = readonly AnyEvent[];
/* eslint-enable @typescript-eslint/no-explicit-any */

export class RouterClass<
  C extends RouterComponentsMap = RouterComponentsMap,
  E extends AnyEventTuple = readonly [],
> extends EventEmitter {
  readonly #events: readonly RouterEvent[];
  #logFilter: boolean | ((payload: LogBubble) => boolean);
  #logger: (payload: LogBubble) => void;
  #bubbleFilter: boolean | ((payload: LogBubble) => boolean);

  constructor(components: C = {} as C, params: RouterParams<E> = {}) {
    super();
    const d = this.#resolveDefaults(params);
    this.#events = d.events;
    this.#logFilter = d.logFilter;
    this.#logger = d.logger;
    this.#bubbleFilter = d.bubbleFilter;
    this.#wireComponents(components);
  }

  #resolveDefaults(params: RouterParams<E>) {
    return {
      events: params.event ?? [],
      logFilter: params.logFilter ?? true,
      logger: params.logger ?? (() => {}),
      bubbleFilter: params.bubbleFilter ?? true,
    };
  }

  #wireComponents(components: C): void {
    for (const [key, value] of Object.entries(components)) {
      if (value instanceof RouterClass) {
        (this as Record<string, unknown>)[key] = value;
        this.#wireSubRouter(key, value);
      } else {
        const method = value as AnyMethod;
        (this as Record<string, unknown>)[key] = method.call.bind(method);
        this.#wireMethod(key, method);
      }
    }
  }

  override emit<K extends EventName<E>>(
    event: K,
    ...args: EmitArgs<E, K>
  ): boolean {
    if (typeof event !== "string") {
      throw new TypeError(
        `Event name must be a string, received ${typeof event}`,
      );
    }
    const schema = this.#events.find((e) => e.name === event);
    if (schema === undefined) {
      throw new TypeError(`Unknown event "${String(event)}"`);
    }
    const payload = args[0];
    schema.validatePayload(payload);
    const bubble: LogBubble = {
      type: "event",
      path: [String(event)],
      payload,
    };
    this.#emitBubble(bubble);
    return super.emit(event, ...args);
  }

  #wireMethod(path: string, method: AnyMethod): void {
    method.on("called", (data) => {
      const bubble: LogBubble = {
        type: "methodCalled",
        path: [path],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: [...data.input],
      };
      this.#emitBubble(bubble);
    });
    method.on("returned", (data) => {
      const bubble: LogBubble = {
        type: "methodReturned",
        path: [path],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: [...data.input],
        output: data.output,
      };
      this.#emitBubble(bubble);
    });
    method.on("errored", (data) => {
      const bubble: LogBubble = {
        type: "methodErrored",
        path: [path],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: [...data.input],
        error:
          data.error instanceof Error
            ? data.error
            : new Error(String(data.error)),
      };
      this.#emitBubble(bubble);
    });
  }

  #emitBubble(bubble: LogBubble): void {
    if (this.#shouldLog(bubble)) {
      this.#logger(bubble);
    }
    if (this.#shouldBubble(bubble)) {
      super.emit(LOG_EVENT, bubble);
    }
  }

  #wireSubRouter(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subRouter: RouterClass<any, any>,
  ): void {
    subRouter.on(LOG_EVENT, (payload: LogBubble) => {
      const newPayload: LogBubble = {
        ...payload,
        path: [key, ...payload.path],
      };
      this.#emitBubble(newPayload);
    });
  }

  #shouldLog(payload: LogBubble): boolean {
    const filter = this.#logFilter;
    if (typeof filter === "boolean") return filter;
    return filter(payload);
  }

  #shouldBubble(payload: LogBubble): boolean {
    const filter = this.#bubbleFilter;
    if (typeof filter === "boolean") return filter;
    return filter(payload);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type RouterComponent =
  RouterMethod<any, any> | RouterAsyncMethod<any, any> | RouterClass<any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type RouterComponentsMap = {
  readonly [key: string]: RouterComponent;
};

export type EventName<E extends AnyEventTuple> = E[number]["name"];

export type EventPayload<E extends AnyEventTuple, K extends EventName<E>> =
  Extract<E[number], { name: K }> extends RouterEvent<
    infer P,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? P
    : never;

export type IsVoidPayload<P> = P extends z.ZodVoid | z.ZodUndefined
  ? true
  : false;

export type EmitArgs<E extends AnyEventTuple, K extends EventName<E>> =
  IsVoidPayload<EventPayload<E, K>> extends true
    ? []
    : [z.infer<EventPayload<E, K>>];

export type RouterParams<E extends AnyEventTuple> = {
  event?: readonly [...E];
  logFilter?: boolean | ((payload: LogBubble) => boolean);
  logger?: (payload: LogBubble) => void;
  bubbleFilter?: boolean | ((payload: LogBubble) => boolean);
};

export type LogBubble =
  | { type: "event"; path: string[]; payload: unknown }
  | { type: "methodCalled"; path: string[]; input: readonly unknown[] }
  | {
      type: "methodReturned";
      path: string[];
      input: readonly unknown[];
      output: unknown;
    }
  | {
      type: "methodErrored";
      path: string[];
      input: readonly unknown[];
      error: Error;
    };

export type RouterShape<C extends RouterComponentsMap> = {
  [K in keyof C]: C[K] extends RouterMethod<infer I, infer O>
    ? (...args: InferInputs<I>) => z.infer<O>
    : C[K] extends RouterAsyncMethod<infer I, infer O>
      ? (...args: InferInputs<I>) => Promise<z.infer<O>>
      : C[K] extends RouterClass<infer SC, infer SE>
        ? RouterClass<SC, SE> & RouterShape<SC>
        : never;
};

type RouterConstructor = {
  new <
    C extends RouterComponentsMap = RouterComponentsMap,
    const E extends AnyEventTuple = readonly [],
  >(
    components?: C,
    params?: RouterParams<E>,
  ): RouterClass<C, E> & RouterShape<C>;
};

export const Router = RouterClass as unknown as RouterConstructor;
