/** PRD 7.4: a busy cloud model can hang for about 3 minutes before it errors, and the SDK does not cut it off. */
export const CLOUD_TIMEOUT_MS = 20_000;

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${Math.round(ms / 1000)} s.`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
