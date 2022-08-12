import { pauseTracking, resetTracking } from "@vue/reactivity";
import {
  currentInstance,
  LifecycleHooks,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";
import { callWithAsyncErrorHandling } from "./errorHandling";

export function injectHook(
  type: LifecycleHooks,
  hook,
  target = currentInstance,
  prepend: boolean = false
) {
  if (target) {
    const hooks = target[type] || (target[type] = []);
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args) => {
        if (target.isUnmounted) {
          return;
        }
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        pauseTracking();
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        setCurrentInstance(target);
        const res = callWithAsyncErrorHandling(hook, args);
        unsetCurrentInstance();
        resetTracking();
        return res;
      });
    if (prepend) {
      hooks.unshift(wrappedHook);
    } else {
      hooks.push(wrappedHook);
    }
    return wrappedHook;
  }
}

// setup执行时(currentInstance为当前instance) 如果有用到生命周期函数 就会将生命周期函数分别收集成数组形式存到实例上
// 当setup执行后 currentInstance会置为null 特定节点才开始遍历实例上对应的生命周期数组 此时如果不利用闭包 执行生命周期时 无法获取currentInstance
// 所以上面利用了闭包 再放入的函数中做了一下处理  每次遍历执行生命周期时 都会设置setCurrentInstance 执行后重置掉
// 所以生命周期中可以获取到组件实例
export const createHook =
  (lifecycle) =>
  (hook, target = currentInstance) =>
    injectHook(lifecycle, hook, target);

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT);
export const onMounted = createHook(LifecycleHooks.MOUNTED);
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE);
export const onUpdated = createHook(LifecycleHooks.UPDATED);
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT);
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED);
