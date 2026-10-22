import { useCallback, useRef, useState } from 'react';
import { formatErrorMessage } from '../utils/errorHandler';

export interface UseAsyncActionOptions<TResult> {
  onError?: (error: unknown, formattedMessage: string) => void;
  onSuccess?: (result: TResult) => void;
  fallbackErrorMessage?: string;
}

/**
 * Wraps an async mutation (submit, approve, reject, upload, delete...) so it cannot run
 * twice at once. The ref lock blocks a second call synchronously, before React
 * re-renders the disabled button, so fast double-clicks never send two requests.
 *
 * Ensures errors are safely captured so that failed mutations do NOT leave pending
 * locks or corrupt application state.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: UseAsyncActionOptions<TResult>
) {
  const lockRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setIsPending(true);
      setError(null);
      try {
        const result = await action(...args);
        options?.onSuccess?.(result);
        return result;
      } catch (err: unknown) {
        const msg = formatErrorMessage(err, options?.fallbackErrorMessage);
        setError(msg);
        options?.onError?.(err, msg);
        throw err;
      } finally {
        lockRef.current = false;
        setIsPending(false);
      }
    },
    [action, options]
  );

  return { run, isPending, error, resetError };
}
