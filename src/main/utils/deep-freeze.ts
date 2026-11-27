/**
 * Recursively marks all properties of an object as readonly.
 *
 * A `RegExp` is left as is, because `Object.freeze` would make its
 * `lastIndex` read-only and break a stateful `/g` or `/y` pattern.
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
 * A `RegExp` value is not frozen: `Object.freeze` would make `lastIndex`
 * read-only and break a stateful `/g` or `/y` pattern. `DeepReadonly` leaves
 * that type alone as well.
 *
 * Internal helper, exported for tests. It is not part of the package API.
 *
 * @param value Value to freeze.
 * @returns The same objects and arrays, frozen in place, and the same `RegExp`
 * values, left mutable; typed as `DeepReadonly`.
 */
export const deepFreeze = <T>(value: T): DeepReadonly<T> => {
    if (value instanceof RegExp) {
        // `Object.freeze` would make `lastIndex` read-only, which breaks
        // stateful use of the pattern; the type keeps `RegExp` mutable.
        return value as DeepReadonly<T>;
    }

    if (typeof value === 'object' && value !== null) {
        Object.values(value as object).forEach((child) => deepFreeze(child));
        Object.freeze(value);
    }

    return value as DeepReadonly<T>;
};
