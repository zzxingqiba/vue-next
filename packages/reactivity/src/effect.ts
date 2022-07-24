import { TrackOpTypes, TriggerOpTypes } from "./operations";
import {
  createDep,
  Dep,
  newTracked,
  wasTracked,
  initDepMarkers,
  finalizeDepMarkers,
} from "./dep";
import { EffectScope } from "./effectScope";
import { extend, isArray, isMap, isIntegerKey } from "@vue/shared";
import { ComputedRefImpl } from "./computed";

export const ITERATE_KEY = Symbol("");
export const MAP_KEY_ITERATE_KEY = Symbol("");

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
  computed?: ComputedRefImpl<T>;
  /**
   * @internal
   */
  allowRecurse?: boolean;
  /**
   * @internal
   */
  private deferStop?: boolean;

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
      return this.fn();
    }
    let parent: ReactiveEffect | undefined = activeEffect;
    let lastShouldTrack = shouldTrack;
    while (parent) {
      if (parent === this) {
        return;
      }
      parent = parent.parent;
    }
    try {
      this.parent = activeEffect;
      activeEffect = this;
      shouldTrack = true;

      trackOpBit = 1 << ++effectTrackDepth;

      if (effectTrackDepth <= maxMarkerBits) {
        // 首次收集不会给dep.w计数 因为没有dep 没收集过
        // 如果有dep 则说明是收集过的依赖的  也就是之后修改属性 再次触发了effect进来的  那么调用wasTracked方法也就是给dep.w添加计数
        // 注意!!! 这里仔细想了下 因为属性和effect是双向收集的 这里的initDepMarkers操作是在给当前这一层级的所有收集的属性初始化一次 是否为收集过依赖的标识
        // 有什么作用呢？ 当接下来属性被读取 会触发track函数 这个时候会给dep.n打上计数(代表了被使用了) 此时会去看一下dep.w是否被计数过 计数过就不在双向收集
        // 再考虑 为什么要计数？ 看例子:
        // effect(()=>{
        //   let name = flagMap.flag? a.name : b.name
        //   document.getElementById('app').innerHTML = name
        // })
        // flagMap.flag = false
        // 当状态改变 再次触发effect 因为三元表达式的存在,
        // 一开始b是没有收集依赖的 收集的是a  再次进入时改变了flag的状态 那么就与a无关了 此时因为遍历当前effect的dep 里面有a 所以给a的dep.w计数
        // 但是a缺触发不到 不会触发track给dep.n计数  那么他最终的状态为dep.w有值 dep.n无值 那么effect结束时 下面finally时调用finalizeDepMarkers检查
        // 就会清除掉a 因为a无论怎么变都不会再触发当前的effect了 只跟b有关系了
        // 新老方式对比 最新的这样只是双方互相清除了需要删除的属性/effect依赖  旧的是都清空 直接全清空  优化了效率
        // finalizeDepMarkers中的判断要求 如果dep.w存在 dep.n不存在 则删除 否则没事
        // 这里想下b的计数情况 应为dep.n = 2 dep.w = 0 满足finalizeDepMarkers中的判断要求 不会被删除
        // 再想想flag的技术情况 应为dep.n = 2 dep.w = 2 满足finalizeDepMarkers中的判断要求 不会被删除
        initDepMarkers(this);
      } else {
        // 旧的兼容写法  在之后采用上面的方法 更快 超过30才会用这个  相当于每次触发effect都清空依赖 重新收集
        cleanupEffect(this);
      }
      // 执行传入fn 为回调中的代理属性收集依赖 会走入对应的get或set中
      // 回到baseHandlers文件中get  会调用track函数
      return this.fn();
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        // 小于30层 还会再最终处理下重复的依赖 暂未知出现场景
        finalizeDepMarkers(this);
      }

      trackOpBit = 1 << --effectTrackDepth;

      activeEffect = this.parent;
      shouldTrack = lastShouldTrack;
      this.parent = undefined;

      if (this.deferStop) {
        this.stop();
      }
    }
  }

  stop() {
    // stopped while running itself - defer the cleanup
    if (activeEffect === this) {
      this.deferStop = true;
    } else if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect);
    }
    deps.length = 0;
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
      // 如果为false  则代表上面执行initDepMarkers方法时 已经标记了dep.w有计数 代表收集过依赖了 就不要再收集了 shouldTrack置为false
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
) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    // never been tracked
    return;
  }
  let deps: (undefined | Dep)[] = [];
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()];
  } else if (key === "length" && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === "length" || key >= (newValue as number)) {
        deps.push(dep);
      }
    });
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          // 这些 ITERATE_KEY 什么情况下用到？
          // 例如:
          // const b = reactive({name:{address:'x'}})
          // watch(b, (newVal, oldVal) => {
          //   console.log(newVal, oldVal)
          // })
          // b.name.a = 'a'
          // watch([()=>b.name.a], (newVal, oldVal) => {
          //   console.log(newVal, oldVal)
          // })
          // b.name.a = 'x'
          // 当监听了一个proxy对象时, 会触发watch去递归循环遍历(for...in)自身属性 目的是为了让所有属性收集依赖,
          // 但是(for...in)时 我们会触发proxy的ownKeys拦截,会首先给对象添加一个Symbol() Key, 并让这上面收集依赖,
          // 当我们添加一个属性上没有的值 就会走到这里此时deps为空 因为没有这个新添加的a属性 所以到这里时又会添加一个什么？
          // 给deps添加了一个Symbol上面收集的Effect, 这里也就是当前watch, 所以下面会去触发watch的回调, 这里例子是触发调度器job
          // 之后watch会去调用当前run() 取一下新值嘛, 那么又走到了最开始 循环遍历，
          // 但是此时不同的是 我们已经有a的值了 这次循环就会使a收集了当前的依赖, 所以之后a更改 会触发例子最后那个监听
          // 感觉和Vue2在Observe类上存dep的操作类型 类似于$set思想一样
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get("length"));
        }
        break;
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }

  if (deps.length === 1) {
    // 对象走这 因为触发set 对象一次只能改一个值dep为 [Set(ReactiveEffect)]
    if (deps[0]) {
      triggerEffects(deps[0]);
    }
  } else {
    const effects: ReactiveEffect[] = [];
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep);
      }
    }
    triggerEffects(createDep(effects));
  }
}

export function triggerEffects(
  dep: Dep | ReactiveEffect[],
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  // spread into array for stabilization
  const effects = isArray(dep) ? dep : [...dep];
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect);
    }
  }
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect);
    }
  }
}

function triggerEffect(effect: ReactiveEffect) {
  // 防止这种情况
  // effect(()=>{
  //   flagMap.flag++
  // })
  // flagMap.flag = 1
  // 防止响应数据在effect外修改了 触发set走到这 此时activeEffect为空 所以会去调run 设置当前修改属性在最开始effect时收集的依赖为effect(执行fn了嘛)
  // 那么effect中如果还对刚才外部的值有修改操作  还会再次走到这  那么effect !== activeEffect 就不会拦截  不拦截就会一直死循环
  if (effect !== activeEffect || effect.allowRecurse) {
    // 如果有调度器
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      // 执行fn 也就是effect传入的函数
      effect.run();
    }
  }
}
