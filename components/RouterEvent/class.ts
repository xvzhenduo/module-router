import type { z } from "zod";

export class RouterEvent<
  P extends z.ZodType = z.ZodUndefined,
  N extends string = string,
> {
  readonly name: N;
  readonly #payload: P | undefined;

  constructor(params: { name: N; payload?: P }) {
    this.name = params.name;
    this.#payload = params.payload;
  }

  validatePayload(payload: unknown): void {
    if (!this.#payload) {
      if (payload !== undefined) {
        throw new TypeError(
          `Payload must be undefined for event "${this.name}"`,
        );
      }
      return;
    }
    const result = this.#payload.safeParse(payload);
    if (!result.success) {
      throw new TypeError(
        `Invalid payload for event "${this.name}": ${result.error.message}`,
      );
    }
  }
}
