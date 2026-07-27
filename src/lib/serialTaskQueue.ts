/**
 * A minimal async mutex: tasks run one at a time, in submission order.
 *
 * Exists because AppProvider persists the whole database as one blob. Every
 * mutation reads the current snapshot, builds the next database and writes it
 * back — so two mutations in flight at once both build from the same snapshot
 * and the second silently erases the first's work. That is not theoretical:
 * the onboarding save chain lost its just-created programme this way, and
 * which half survived (template or plan) came down to timing.
 *
 * Wrapping each mutation in `runExclusive` makes the read-modify-write atomic:
 * a task only starts after the previous one has finished writing, so its
 * snapshot always includes the previous task's result.
 */
export type RunExclusive = <T>(task: () => Promise<T> | T) => Promise<T>;

export function createSerialTaskQueue(): RunExclusive {
  let tail: Promise<unknown> = Promise.resolve();

  return function runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
    const result = tail.then(() => task());
    // A failed task must reject its own caller but never jam the queue.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
