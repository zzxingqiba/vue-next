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
