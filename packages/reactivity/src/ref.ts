import {
  activeEffect,
  shouldTrack,
  trackEffects,
  triggerEffects,
} from "./effect";
import { createDep, Dep } from "./dep";
import { toRaw } from "./reactive";

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
