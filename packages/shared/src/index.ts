import { makeMap } from "./makeMap";
export * from "./typeUtils";
export * from "./shapeFlags";
export * from "./patchFlags";
export * from "./normalizeProp";
export * from "./domAttrConfig";

export { makeMap };

/**
 * Always return false.
 */
export const NO = () => false;

export const EMPTY_OBJ: { readonly [key: string]: any } = {};

export const EMPTY_ARR = [];

export const NOOP = () => {};

const onRE = /^on[^a-z]/;
export const isOn = (key: string) => onRE.test(key);

export const isModelListener = (key: string) => key.startsWith("onUpdate:");

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
export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === "[object Object]";

export const extend = Object.assign;

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== "NaN" &&
  key[0] !== "-" &&
  "" + parseInt(key, 10) === key;

// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue);

let _globalThis: any;
export const getGlobalThis = (): any => {
  return (
    _globalThis ||
    (_globalThis =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof self !== "undefined"
        ? self
        : typeof window !== "undefined"
        ? window
        : {})
  );
};

export const isReservedProp = /*#__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key," +
    "onVnodeBeforeMount,onVnodeMounted," +
    "onVnodeBeforeUpdate,onVnodeUpdated," +
    "onVnodeBeforeUnmount,onVnodeUnmounted"
);

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null);
  return ((str: string) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  }) as any;
};

const hyphenateRE = /\B([A-Z])/g;
/**
 * @private
 */
export const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, "-$1").toLowerCase()
);

/**
 * @private
 */
export const capitalize = cacheStringFunction(
  (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
);


const camelizeRE = /-(\w)/g;
/**
 * @private
 */
export const camelize = cacheStringFunction((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ""));
});

/**
 * @private
 */
 export const toHandlerKey = cacheStringFunction((str: string) =>
 str ? `on${capitalize(str)}` : ``
)