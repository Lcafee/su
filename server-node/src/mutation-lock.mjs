import { ApiError } from './http.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;

export function createMutationLock({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let tail = Promise.resolve();
  let queued = 0;

  async function run(operation) {
    queued += 1;
    let release;
    const turn = new Promise((resolve) => { release = resolve; });
    const previous = tail;
    tail = previous.catch(() => {}).then(() => turn);

    let timer;
    try {
      await Promise.race([
        previous.catch(() => {}),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new ApiError(
              503,
              'media_lifecycle_busy',
              'Managed media is temporarily busy. Retry shortly.',
            ));
          }, timeoutMs);
          timer.unref?.();
        }),
      ]);
      if (timer) clearTimeout(timer);
      return await operation();
    } finally {
      if (timer) clearTimeout(timer);
      queued -= 1;
      release();
    }
  }

  return Object.freeze({
    run,
    get queued() { return queued; },
  });
}
