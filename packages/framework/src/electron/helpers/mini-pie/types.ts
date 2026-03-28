/**
 * This is an alias of `any` type
 */
export type Any = any;

export type Constructor<T extends Any = Any> = { new (...args: Any[]): T };
