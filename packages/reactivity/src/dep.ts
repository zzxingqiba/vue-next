import { ReactiveEffect, trackOpBit } from "./effect";

export type Dep = Set<ReactiveEffect> & TrackedMarkers;

type TrackedMarkers = {
  /**
   * wasTracked
   */
  w: number;
  /**
   * newTracked
   */
  n: number;
};

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep;
  dep.w = 0;
  dep.n = 0;
  return dep;
};

export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0;

export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0;

export const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    // 暂未可知
    for (let i = 0; i < deps.length; i++) {
      deps[i].w |= trackOpBit; // set was tracked
    }
  }
};

export const finalizeDepMarkers = (effect: ReactiveEffect) => {
  const { deps } = effect;
  if (deps.length) {
    let ptr = 0;
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect);
      } else {
        deps[ptr++] = dep;
      }
      // clear bits
      // 前面会进行 |= 位运算
      // 这里 &= ~会重置dep.w / dep.n为或前的初始值
      // 多级嵌套逐层下去就会回到0的状态
      dep.w &= ~trackOpBit;
      dep.n &= ~trackOpBit;
    }
    deps.length = ptr;
  }
};
