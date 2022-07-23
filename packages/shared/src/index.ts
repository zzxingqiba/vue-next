import { makeMap } from "./makeMap";

export { makeMap };

export const NOOP = () => {}

export const isString = (val: unknown): val is string =>
  typeof val === "string";
const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key);

export const isArray = Array.isArray;
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === "object";

export const objectToString: Function = Object.prototype.toString;
export const toTypeString = (value: unknown): string =>
  objectToString.call(value);
export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1);
};

export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value,
  });
};

export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === "[object Map]";
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === "[object Set]";
export const isFunction = (val: unknown): val is Function =>
  typeof val === "function";
export const isSymbol = (val: unknown): val is symbol =>
  typeof val === "symbol";

export const extend = Object.assign;

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== "NaN" &&
  key[0] !== "-" &&
  "" + parseInt(key, 10) === key;

// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue);
