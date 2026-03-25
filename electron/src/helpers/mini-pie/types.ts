/**
 * This is an alias of `any` type
 */
export type Any = any;

/**
 * Defines a package of informations that can be passed
 * through various stage of the http request lifecycle.
 *
 * Mainly those informations can be passed through
 * - The `@Repository` decorator in the `@Policy` decorated classes
 * - Via the `repository` param of `@Route`
 *
 * It is designed to always contain the `ip` and the `userAgent`
 * of the request if the decorated with `@Route` method is executed by
 * the server via an http request and not directly
 */
export type $Repository<T extends {} = {}> = T & {
  ip?: string;
  userAgent?: string;
  routeIndex?: number;
  host?: string;
  originalUrl?: string;
};
/**
 * Defines the http body payload of a request in a `JSONObject` form
 */
export type $Body<T extends {}> = T & {};
/**
 * Defines a `JSONObject` { `key`: `value` } where `key` is a portion of the
 * endpoint path notated with `:` and `value` is the portion of the path
 * that arrives from the request
 *
 * @example
 * ```ts
 * // given a path definition like '/my/path/with/:something' and a request
 * // provided using '/my/path/with/a-good-coffee' the result will be
 * const $params: $Params<{ something: string }> = {
 *   something: 'a-good-coffee'
 * };
 * ```
 */
export type $Params<T extends {}> = T & {};
export type $Query<T extends {}> = T & {};
export type $Headers<T extends {}> = T & {};
export type $Result<T extends { (...args: Any[]): Any }> = Awaited<ReturnType<T>> | Error;

export type Constructor<T extends Any = Any> = { new (...args: Any[]): T };
