import { EventEmitter } from "node:events";

import { z } from "zod";

import type {
  CalledEventData,
  ErroredEventData,
  InferInputs,
  ReturnedEventData,
} from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class RouterAsyncMethod<
  I extends readonly z.ZodType[] = [],
  O extends z.ZodType = z.ZodVoid,
> extends EventEmitter {
  readonly #input: I;
  readonly #output: O;
  readonly #handler: (...args: InferInputs<I>) => Promise<z.infer<O>>;

  constructor(params: {
    input?: I;
    output?: O;
    handler: (...args: InferInputs<I>) => Promise<z.infer<O>>;
  }) {
    super();
    this.#input = params.input ?? ([] as unknown as I);
    this.#output = (params.output ?? z.void()) as O;
    this.#handler = params.handler;
  }

  async call(...args: InferInputs<I>): Promise<z.infer<O>> {
    this.emit("called", { input: args });
    this.#validateInputs(args);
    let output: z.infer<O>;
    try {
      output = await this.#handler(...args);
    } catch (error) {
      this.emit("errored", { input: args, error });
      throw error;
    }
    this.emit("returned", { input: args, output });
    this.#validateOutput(output);
    return output;
  }

  #validateInputs(args: InferInputs<I>): void {
    if (args.length !== this.#input.length) {
      throw new TypeError(
        `Expected ${this.#input.length} argument(s), received ${args.length}`,
      );
    }
    for (let i = 0; i < this.#input.length; i++) {
      const result = this.#input[i]!.safeParse(args[i]);
      if (!result.success) {
        throw new TypeError(
          `Invalid argument at index ${i}: ${result.error.message}`,
        );
      }
    }
  }

  #validateOutput(output: z.infer<O>): void {
    const result = this.#output.safeParse(output);
    if (!result.success) {
      throw new TypeError(`Invalid output: ${result.error.message}`);
    }
  }
}

export interface RouterAsyncMethod<
  I extends readonly z.ZodType[] = [],
  O extends z.ZodType = z.ZodVoid,
> {
  on(event: "called", listener: (data: CalledEventData<I>) => void): this;
  on(
    event: "returned",
    listener: (data: ReturnedEventData<I, O>) => void,
  ): this;
  on(event: "errored", listener: (data: ErroredEventData<I>) => void): this;
  off(event: "called", listener: (data: CalledEventData<I>) => void): this;
  off(
    event: "returned",
    listener: (data: ReturnedEventData<I, O>) => void,
  ): this;
  off(event: "errored", listener: (data: ErroredEventData<I>) => void): this;
  emit(event: "called", data: CalledEventData<I>): boolean;
  emit(event: "returned", data: ReturnedEventData<I, O>): boolean;
  emit(event: "errored", data: ErroredEventData<I>): boolean;
}
