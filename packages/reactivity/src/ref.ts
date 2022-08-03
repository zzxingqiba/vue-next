import {
  activeEffect,
  shouldTrack,
  trackEffects,
  triggerEffects,
} from "./effect";
import { createDep, Dep } from "./dep";
import { isReactive, toRaw, toReactive } from "./reactive";
import { hasChanged, IfAny, isArray } from "@vue/shared";

export interface Ref<T = any> {
  value: T;
}
export type UnwrapRefSimple<T> = T;

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>;
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true);
}

type RefBase<T> = {
  dep?: Dep;
  value: T;
};

function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}

class RefImpl<T> {
  private _value: T;
  private _rawValue: T;

  public dep?: Dep = undefined;
  public readonly __v_isRef = true;

  constructor(value: T, public readonly __v_isShallow: boolean) {
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : toReactive(value);
  }

  get value() {
    trackRefValue(this);
    return this._value;
  }

  set value(newVal) {
    newVal = this.__v_isShallow ? newVal : toRaw(newVal);
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = this.__v_isShallow ? newVal : toReactive(newVal);
      triggerRefValue(this, newVal);
    }
  }
}

export function ref(value?: unknown) {
  return createRef(value, false);
}

export function trackRefValue(ref: RefBase<any>) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref);
    trackEffects(ref.dep || (ref.dep = createDep()));
  }
}

export function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  ref = toRaw(ref);
  if (ref.dep) {
    triggerEffects(ref.dep);
  }
}

export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? (ref.value as any) : ref;
}

const shallowUnwrapHandlers: ProxyHandler<any> = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  },
};

export type ShallowUnwrapRef<T> = {
  [K in keyof T]: T[K] extends Ref<infer V>
    ? V
    : // if `V` is `unknown` that means it does not extend `Ref` and is undefined
    T[K] extends Ref<infer V> | undefined
    ? unknown extends V
      ? undefined
      : V | undefined
    : T[K];
};

export function proxyRefs<T extends object>(
  objectWithRefs: T
): ShallowUnwrapRef<T> {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>;

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue?: T[K]
): ToRef<T[K]> {
  const val = object[key];
  return isRef(val)
    ? val
    : (new ObjectRefImpl(object, key, defaultValue) as any);
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true;

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K]
  ) {}

  get value() {
    const val = this._object[this._key];
    return val === undefined ? (this._defaultValue as T[K]) : val;
  }

  set value(newVal) {
    this._object[this._key] = newVal;
  }
}

export type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>;
};

export function toRefs<T extends object>(object: T): ToRefs<T> {
  const ret: any = isArray(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}
