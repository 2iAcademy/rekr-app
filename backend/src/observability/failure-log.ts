import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

export const requestContext = new AsyncLocalStorage<{ request_id: string }>();

export function writeFailure(
  event: string,
  fields: Record<string, unknown>,
): void {
  console.error(
    JSON.stringify({
      timestamp: Date.now(),
      level: 'error',
      service: 'backend',
      event,
      ...requestContext.getStore(),
      ...fields,
    }),
  );
}

/** Log one failed operation, preserving the original error and caller fallback.
 * Never serialize SDK errors: messages can include credentials or request data.
 */
export async function externalCall<T>(
  dependency: string,
  operation: string,
  call: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await call();
  } catch (cause) {
    const code: unknown =
      typeof cause === 'object' && cause !== null && 'code' in cause
        ? (cause as { code: unknown }).code
        : undefined;
    const safeCodes = new Set([
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'EAUTH',
      'ESOCKET',
      'ECONNECTION',
      'ETLS',
    ]);
    const name = cause instanceof Error ? cause.name : '';
    const safeTypes = new Set([
      'Error',
      'ConnectionError',
      'TimeoutError',
      'ResponseError',
      'RequestAbortedError',
      'StreamChatError',
    ]);
    writeFailure('external_service_failed', {
      error_type: safeTypes.has(name) ? name : 'DependencyError',
      dependency,
      operation,
      duration_ms: Math.round(performance.now() - started),
      error_code:
        typeof code === 'string' && safeCodes.has(code)
          ? code
          : 'DEPENDENCY_ERROR',
    });
    throw cause;
  }
}
