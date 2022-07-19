import { TrackOpTypes, TriggerOpTypes } from "./operations";
import { createDep, Dep, newTracked, wasTracked, initDepMarkers, finalizeDepMarkers } from "./dep";
import { EffectScope } from "./effectScope";
import { extend } from "@vue/shared";

type KeyToDepMap = Map<any, Dep>;
const targetMap = new WeakMap<any, KeyToDepMap>();

// The number of effects currently being tracked recursively.
let effectTrackDepth = 0;

export let trackOpBit = 1;

/**
 * The bitwise track markers support at most 30 levels of recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */
const maxMarkerBits = 30;

export type EffectScheduler = (...args: any[]) => any;

export type DebuggerEvent = {
  effect: ReactiveEffect;
} & DebuggerEventExtraInfo;

export type DebuggerEventExtraInfo = {
  target: object;
  type: TrackOpTypes | TriggerOpTypes;
  key: any;
  newValue?: any;
  oldValue?: any;
  oldTarget?: Map<any, any> | Set<any>;
};

export let activeEffect: ReactiveEffect | undefined;

export class ReactiveEffect<T = any> {
  active = true;
  deps: Dep[] = [];
  parent: ReactiveEffect | undefined = undefined;

  /**
   * Can be attached after creation
   * @internal
   */
  //  computed?: ComputedRefImpl<T>
   /**
    * @internal
    */
   allowRecurse?: boolean
   /**
    * @internal
    */
   private deferStop?: boolean

  onStop?: () => void;
  // dev only
  onTrack?: (event: DebuggerEvent) => void;
  // dev only
  onTrigger?: (event: DebuggerEvent) => void;

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope
  ) {
    // ##未知
    // recordEffectScope(this, scope)
  }

  run() {
    if (!this.active) {
      return this.fn()
    }
    let parent: ReactiveEffect | undefined = activeEffect
    let lastShouldTrack = shouldTrack
    while (parent) {
      if (parent === this) {
        return
      }
      parent = parent.parent
    }
    try {
      this.parent = activeEffect
      activeEffect = this
      shouldTrack = true

      trackOpBit = 1 << ++effectTrackDepth

      if (effectTrackDepth <= maxMarkerBits) {
        // 没执行过内部逻辑 暂未知
        initDepMarkers(this)
      } else {
        cleanupEffect(this)
      }
      // 执行传入fn 为回调中的代理属性收集依赖 会走入对应的get或set中
      // 回到baseHandlers文件中get  会调用track函数
      return this.fn()
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        // 小于30层 还会再最终处理下重复的依赖 暂未知出现场景
        finalizeDepMarkers(this)
      }

      trackOpBit = 1 << --effectTrackDepth

      activeEffect = this.parent
      shouldTrack = lastShouldTrack
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    // stopped while running itself - defer the cleanup
    // if (activeEffect === this) {
    //   this.deferStop = true
    // } else if (this.active) {
    //   cleanupEffect(this)
    //   if (this.onStop) {
    //     this.onStop()
    //   }
    //   this.active = false
    // }
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  lazy?: boolean;
  scheduler?: EffectScheduler;
  scope?: EffectScope;
  allowRecurse?: boolean;
  onStop?: () => void;
}

export interface ReactiveEffectRunner<T = any> {
  (): T;
  effect: ReactiveEffect;
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  // 如果已经是effect,先重置为原始对象
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn;
  }
  const _effect = new ReactiveEffect(fn);
  if (options) {
    extend(_effect, options);
    // if (options.scope) recordEffectScope(_effect, options.scope);
  }
  if (!options || !options.lazy) {
    _effect.run();
  }
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner;
  runner.effect = _effect;
  return runner;
}

export let shouldTrack = true;
const trackStack: boolean[] = [];

export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    // 收集开始
    // target 为 { name:'zz' }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      // 不存在则初始化
      // key为{ name:'zz' } value为空Map对象
      targetMap.set(target, (depsMap = new Map()));
    }
    // Map中查找 未找到则初始化
    // key为name  value为Set对象
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = createDep()));
    }
    trackEffects(dep);
  }
}

export function trackEffects(dep: Dep) {
  let shouldTrack = false;
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit; // set newly tracked
      shouldTrack = !wasTracked(dep);
    }
  } else {
    // 超过maxMarkerBits 30层 降级处理 清空当前dep所有依赖  下次触发再重新收集
    // Full cleanup mode.
    shouldTrack = !dep.has(activeEffect!);
  }

  if (shouldTrack) {
    // 双向收集依赖
    dep.add(activeEffect!);
    activeEffect!.deps.push(dep);
  }
}

export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
){
  
}