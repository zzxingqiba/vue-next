import {
  reactive,
  ReactiveFlags,
  Target,
  toRaw,
  readonlyMap,
  reactiveMap,
  shallowReactiveMap,
  shallowReadonlyMap,
} from "./reactive";
import { track } from "./effect";
import { TrackOpTypes, TriggerOpTypes } from "./operations";
import { isArray, hasOwn, isSymbol, makeMap } from "@vue/shared";

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(
  /*#__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter((key) => key !== "arguments" && key !== "caller")
    .map((key) => (Symbol as any)[key])
    .filter(isSymbol)
);

const get = /*#__PURE__*/ createGetter();
const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations();

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {};
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  (["includes", "indexOf", "lastIndexOf"] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any;
      // for (let i = 0, l = this.length; i < l; i++) {
      //   track(arr, TrackOpTypes.GET, i + '')
      // }
      // // we run the method using the original args first (which may be reactive)
      // const res = arr[key](...args)
      // if (res === -1 || res === false) {
      //   // if that didn't work, run it again using raw values.
      //   return arr[key](...args.map(toRaw))
      // } else {
      //   return res
      // }
    };
  });
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  // ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
  //   instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
  //     pauseTracking()
  //     const res = (toRaw(this) as any)[key].apply(this, args)
  //     resetTracking()
  //     return res
  //   }
  // })
  return instrumentations;
}

function createGetter(isReadonly = false, shallow = false) {
  // 以 const state = reactive({ name: 'hh' }) 为例
  /* 
    target为 {name: 'hh'}
    key为 'name'
    receiver为当前target的Proxy对象
  */
  return function get(target: Target, key: string | symbol, receiver: object) {
    // 处理一些情况 例如在reactive文件中createReactiveObject函数中的描述
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow;
    } else if (
      key === ReactiveFlags.RAW &&
      receiver ===
        (isReadonly
          ? shallow
            ? shallowReadonlyMap
            : readonlyMap
          : shallow
          ? shallowReactiveMap
          : reactiveMap
        ).get(target)
    ) {
      return target;
    }
    // const targetIsArray = isArray(target);
    // if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
    //   return Reflect.get(arrayInstrumentations, key, receiver);
    // }
    const res = Reflect.get(target, key, receiver);
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly) {
      debugger;
      track(target, TrackOpTypes.GET, key);
    }

    return res;
  };
}
export const mutableHandlers: ProxyHandler<object> = {
  get,
  // set,
  // deleteProperty,
  // has,
  // ownKeys
};
