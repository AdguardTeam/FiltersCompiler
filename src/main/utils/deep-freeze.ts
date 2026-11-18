/**
 * Recursively marks all properties of an object as readonly.
 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends RegExp
      ? T
      : T extends readonly (infer U)[]
        ? readonly DeepReadonly<U>[]
        : T extends object
          ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
          : T;

/**
 * Freezes an object and every nested object and array.
 *
 * Internal helper, exported for tests. It is not part of the package API.
 *
 * @param value Value to freeze.
 * @returns The same value, frozen in place, typed as recursively readonly.
 */
export const deepFreeze = <T>(value: T): DeepReadonly<T> => {
    if (typeof value === 'object' && value !== null) {
        Object.values(value as object).forEach((child) => deepFreeze(child));
        Object.freeze(value);
    }

    return value as DeepReadonly<T>;
};
