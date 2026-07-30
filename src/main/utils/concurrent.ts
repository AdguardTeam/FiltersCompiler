/**
 * Runs `fn` over `items` with at most `concurrency` calls in flight at once.
 *
 * @param items - Items to process.
 * @param max - Max number of concurrent `fn` calls.
 * @param fn - Async worker invoked for each item.
 */
export const mapWithConcurrency = async <T>(
    items: T[],
    max: number,
    fn: (item: T) => Promise<void>,
): Promise<void> => {
    if (max <= 0) {
        throw new Error('max must be a positive integer');
    }

    const workerCount = Math.min(max, items.length);

    // Each worker owns a fixed, disjoint slice of indices (workerIndex, workerIndex + workerCount, ...)
    // decided up front, so there's no shared mutable state for workers to race over.
    const worker = async (startIndex: number) => {
        for (let i = startIndex; i < items.length; i += workerCount) {
            // eslint-disable-next-line no-await-in-loop
            await fn(items[i]);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, (_, startIndex) => worker(startIndex)));
};
