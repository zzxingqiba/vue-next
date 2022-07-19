import {
  reactive,
  ReactiveFlags,
  Target,
  toRaw,
  readonlyMap,
  reactiveMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  isReadonly,
  isShallow
} from "./reactive";
import { track, trigger } from "./effect";
import { TrackOpTypes, TriggerOpTypes } from "./operations";
import { isArray, hasOwn, isSymbol, makeMap, isIntegerKey, hasChanged } from "@vue/shared";
import { isRef } from './ref'

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
      // const arr = toRaw(this) as any;
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
      // 初始reactive时并不会执行, effect触发时,其中内部使用了reactive处理的值 会使当前全局变量activeEffect(当前effect)有值 继而进入track函数内部执行逻辑代码
      // 给属性收集当前effect
      track(target, TrackOpTypes.GET, key);
    }

    return res;
  };
}

const set = /*#__PURE__*/ createSetter()
function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    debugger
    let oldValue = (target as any)[key]
    if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
      return false
    }
    if (!shallow && !isReadonly(value)) {
      if (!isShallow(value)) {
        value = toRaw(value)
        oldValue = toRaw(oldValue)
      }
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}


export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  // deleteProperty,
  // has,
  // ownKeys
};
