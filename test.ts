import z from "zod";

import {
  Router,
  RouterAsyncMethod,
  RouterEvent,
  RouterMethod,
} from "./index.ts";

const sleep = async (ms: number) => {
  const { promise, resolve } = Promise.withResolvers();
  setTimeout(resolve, ms);
  await promise;
};

const sleepMethod = new RouterAsyncMethod({
  input: [z.number()],
  handler: sleep,
});

const addMethod = new RouterMethod({
  input: [z.number(), z.number()],
  output: z.number(),
  handler: (value1, value2) => {
    return value1 + value2;
  },
});

const testEvent = new RouterEvent({
  name: "test",
  payload: z.string(),
});

const subRouter = new Router(
  { sleep: sleepMethod, add: addMethod },
  { event: [testEvent] },
);

const emitTestEventMethod = new RouterMethod({
  handler: () => {
    subRouter.emit("test", "Hello");
  },
});

const router = new Router({
  sub: subRouter,
  emitTestEvent: emitTestEventMethod,
});

await router.sub.sleep(100);
