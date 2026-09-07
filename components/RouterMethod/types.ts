import type { z } from "zod";

export type InferInputs<T extends readonly z.ZodType[]> = {
  [K in keyof T]: T[K] extends z.ZodType ? z.infer<T[K]> : never;
};

export type CalledEventData<I extends readonly z.ZodType[]> = {
  input: InferInputs<I>;
};

export type ReturnedEventData<
  I extends readonly z.ZodType[],
  O extends z.ZodType,
> = {
  input: InferInputs<I>;
  output: z.infer<O>;
};

export type ErroredEventData<I extends readonly z.ZodType[]> = {
  input: InferInputs<I>;
  error: unknown;
};
