import { isFunction } from "@vue/shared";
import { reactive } from "@vue/reactivity";

export function applyOptions(instance) {
  const options = resolveMergedOptions(instance);
  const publicThis = instance.proxy! as any;
  const ctx = instance.ctx;
  const {
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // lifecycle
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    // public API
    expose,
    inheritAttrs,
    // assets
    components,
    directives,
    filters,
  } = options as any;

  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key];
      if (isFunction(methodHandler)) {
        ctx[key] = methodHandler.bind(publicThis);
      }
    }
  }
  if (dataOptions) {
    const data = dataOptions.call(publicThis, publicThis);
    instance.data = reactive(data);
  }
  if (computedOptions) {
  }
  if (watchOptions) {
  }
}

/**
 * Resolve merged options and cache it on the component.
 * This is done only once per-component since the merging does not involve
 * instances.
 */
// 缓存组件 将mixin之类的合并进去 暂不考虑
export function resolveMergedOptions(instance) {
  const base = instance.type;
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies },
  } = instance.appContext;
  let resolved = {};
  const cached = cache.get(base);
  if (cached) {
    resolved = cached;
  } else {
    resolved = base;
  }
  cache.set(base, resolved);
  return resolved;
}
