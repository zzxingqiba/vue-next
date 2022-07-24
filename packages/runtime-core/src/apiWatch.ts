import {
  isRef,
  Ref,
  ComputedRef,
  DebuggerOptions,
  isShallow,
  isReactive,
  ReactiveEffect,
  EffectScheduler,
  ReactiveFlags,
} from "@vue/reactivity";
import { queuePreFlushCb, SchedulerJob } from "./scheduler";
import {
  EMPTY_OBJ,
  isArray,
  isFunction,
  NOOP,
  hasChanged,
  isSet,
  isMap,
  isPlainObject,
  isObject,
} from "@vue/shared";
import {
  callWithAsyncErrorHandling,
  callWithErrorHandling,
} from "./errorHandling";

export type WatchEffect = (onCleanup: OnCleanup) => void;
type OnCleanup = (cleanupFn: () => void) => void;

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

export interface WatchOptionsBase extends DebuggerOptions {
  flush?: "pre" | "post" | "sync";
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate;
  deep?: boolean;
}

export type WatchStopHandle = () => void;

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any;

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {};

// watch实现
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  return doWatch(source as any, cb, options);
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  { immediate, deep, flush }: WatchOptions = EMPTY_OBJ
) {
  let getter: () => any = NOOP;
  let forceTrigger = false;
  let isMultiSource = false;
  if (isRef(source)) {
    getter = () => source.value;
    forceTrigger = isShallow(source);
  } else if (isReactive(source)) {
    getter = () => source;
    deep = true;
  } else if (isArray(source)) {
    isMultiSource = true;
    forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
    getter = () =>
      source.map((s) => {
        if (isRef(s)) {
          return s.value;
        } else if (isReactive(s)) {
          return traverse(s);
        } else if (isFunction(s)) {
          return callWithErrorHandling(s);
        }
      });
  } else if (isFunction(source)) {
    if (cb) {
      // getter with cb
      getter = () => callWithErrorHandling(source);
    } else {
      // ##未知  感觉是监听effect的
      // no cb -> simple effect
      // getter = () => {
      //   if (cleanup) {
      //     cleanup()
      //   }
      //   return callWithAsyncErrorHandling(
      //     source,
      //     null,
      //     null,
      //     [onCleanup]
      //   )
      // }
    }
  } else {
    getter = NOOP;
  }

  if (cb && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }

  let cleanup: () => void;
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = effect.onStop = () => {
      callWithErrorHandling(fn);
    };
  };

  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE;

  // 调度器被触发了 scheduler文件中 flushPreFlushCbs去过重了
  // 虽然每个watch会收集他自己对应的job 但是对于每一个watch来说 自己监视的属性多次改变时收集的job都是同一个 去重后 只会触发一次job
  // 来看下面发生了什么 盲猜调用了cb 因为getter是监视的属性 cb自然要调度器来调用了 这也是起名SchedulerJob的原因吧
  const job: SchedulerJob = () => {
    // 监视属性发生改变 触发调度器走进这里
    if (!effect.active) {
      return;
    }
    if (cb) {
      // watch(source, cb)
      // 获取到新值
      const newValue = effect.run();
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue)) // 一般走这里 比较新旧值是否一致
      ) {
        // cleanup before running cb again
        // 这个后续再看  可以利用这里做一个闭包  使用情景  只会触发一次输出  因为同步任务先执行 flush:'sync'同步执行
        // 执行了两次后下次总将上次的置为了true 看上面的英文备注 在第二次调cb前 回去调一下第一次存入的cleanup 置为true 再去执行cb 执行cb时传入的又是新的clear  总结还是利用了闭包
        // function getData(timer){
        //   return new Promise((resolve, reject) => {
        //     setTimeout(()=>{
        //       resolve(timer)
        //     }, timer)
        //   })
        // }
        // // debugger
        // let i = 3000
        // watch(() => a.name, async(newVal,oldVal, onCleanup)=>{
        //   let clear = false
        //   onCleanup(() => {
        //     clear = true
        //   })
        //   i -= 1000
        //   let r = await getData(i)
        //   if(!clear) console.log(newVal,oldVal)
        // }, {
        //   flush:'sync'
        // })
        // a.name = 'x'
        // a.name = '12441'
        if (cleanup) {
          cleanup();
        }
        // 进入看一下 就是执行cb函数将 新值旧值传递给cb而已 这样就做到了观察的属性发生改变 watch会被出发
        callWithAsyncErrorHandling(cb, [
          newValue,
          // 首次为oldValue为undefined
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onCleanup,
        ]);
        // 新值赋值给旧值
        oldValue = newValue;
      }
    } else {
      // watchEffect
      effect.run();
    }
  };

  // important: mark the job as a watcher callback so that scheduler knows
  // it is allowed to self-trigger (#1727)
  job.allowRecurse = !!cb;

  let scheduler: EffectScheduler = () => {};

  if (flush === "sync") {
    // 正常会是异步执行 也就是多次改变监听值 只会触发一次 但是走了这里就代表 每改变一次 就直接调用cb  改了多少次就调用多少次
    scheduler = job as any; // the scheduler function gets called directly
  } else if (flush === "post") {
    // ##未尝试 需要写完渲染才能用这里看到现象 官网解释 如果需要在组件更新(例如：当与模板引用一起)后重新运行侦听器副作用
    // 看了下代码 将job放到了渲染完页面执行了  也就相当于在watch中获取dom元素  要提供flush: 'post'配置才能获取到最新dom  和vue2的nextTick一样 只不过这里写在watch中用的
    // scheduler = () => queuePostRenderEffect(job)
  } else {
    // default: 'pre'
    // 平常走这里 看一下scheduler中的 queuePreFlushCb  感觉是在批处理而已(watch是放在promise中执行的)  最后会调用job
    // 这里因为是放在promise中执行的 所以同一个值多次改变 只会触发一次watch会调
    scheduler = () => queuePreFlushCb(job);
  }

  // 当属性发生改变 触发了调度器 走scheduler  看scheduler的逻辑
  const effect = new ReactiveEffect(getter, scheduler);

  // initial run
  if (cb) {
    if (immediate) {
      job();
    } else {
      // 1.函数形式
      // watch(() => a.name, (newVal, oldVal) => {
      //   console.log(newVal, oldVal)
      // })
      // 执行() => a.name 让被观察的属性收集当前ReactiveEffect(彼此双向收集)  得到值赋值给oldValue
      oldValue = effect.run();
    }
  } else if (flush === "post") {
    // queuePostRenderEffect(
    //   effect.run.bind(effect),
    //   instance && instance.suspense
    // )
  } else {
    effect.run();
  }

  return () => {
    // sync时会执行stop前的改变  pre普通watch一次监听也不会触发 因为是watch是微任务
    effect.stop();
  };
}
export function traverse(value: unknown, seen?: Set<unknown>) {
  if (!isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value;
  }
  seen = seen || new Set();
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (isRef(value)) {
    traverse(value.value, seen);
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen);
    });
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse((value as any)[key], seen);
    }
  }
  return value;
}
