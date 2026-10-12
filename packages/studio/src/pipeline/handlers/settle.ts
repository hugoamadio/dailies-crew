/**
 * Like Promise.all, but waits for every call to finish before rethrowing the first failure, so the
 * failed attempt still records the cost of the sibling calls that were paid for.
 */
export async function allSettledOrThrow<T extends readonly unknown[]>(promises: {
  [K in keyof T]: Promise<T[K]>;
}): Promise<T> {
  const settled = await Promise.allSettled(promises);
  const failed = settled.find((item): item is PromiseRejectedResult => item.status === 'rejected');
  if (failed) throw failed.reason;
  return settled.map((item) => (item as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
