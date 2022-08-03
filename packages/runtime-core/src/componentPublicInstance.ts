import { EMPTY_OBJ, hasOwn } from "@vue/shared";
import { NOOP, extend } from "@vue/shared";
import { toRaw, track, TrackOpTypes } from "@vue/reactivity";

const enum AccessTypes {
  OTHER,
  SETUP,
  DATA,
  PROPS,
  CONTEXT,
}

export const publicPropertiesMap = extend(Object.create(null), {
  $: (i) => i,
  $el: (i) => i.vnode.el,
  $data: (i) => i.data,
  $props: (i) => i.props,
  $attrs: (i) => i.attrs,
  $slots: (i) => i.slots,
  $refs: (i) => i.refs,
  $parent: (i) => i.parent,
  $root: (i) => i.root,
  $emit: (i) => i.emit,
  $options: (i) => i.type,
  $forceUpdate: (i) => NOOP,
  $nextTick: (i) => NOOP,
  $watch: (i) => NOOP,
});

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key: string) {
    const { ctx, setupState, data, props, accessCache, type, appContext } =
      instance;
    let normalizedProps;
    // 创建了缓存区
    if (key[0] !== "$") {
      const n = accessCache![key];
      if (n !== undefined) {
        switch (n) {
          case AccessTypes.SETUP:
            return setupState[key];
          case AccessTypes.DATA:
            return data[key];
          case AccessTypes.CONTEXT:
            return ctx[key];
          case AccessTypes.PROPS:
            return props![key];
          // default: just fallthrough
        }
      } else if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
        accessCache![key] = AccessTypes.SETUP;
        return setupState[key];
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache![key] = AccessTypes.DATA;
        return data[key];
      } else if (
        // only cache other properties when instance has declared (thus stable)
        // props
        (normalizedProps = instance.propsOptions[0]) &&
        hasOwn(normalizedProps, key)
      ) {
        accessCache![key] = AccessTypes.PROPS;
        return props![key];
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache![key] = AccessTypes.CONTEXT;
        return ctx[key];
      }
    }

    const publicGetter = publicPropertiesMap[key];
    // public $xxx properties
    if (publicGetter) {
      if (key === "$attrs") {
        track(instance, TrackOpTypes.GET, key);
      }
      return publicGetter(instance);
    }
    // ...之类instance上的值
  },
  set({ _: instance }, key: string, value: any) {
    const { data, setupState, ctx } = instance;
    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value;
      return true;
    } else if (hasOwn(instance.props, key)) {
      console.warn(`Attempting to mutate prop "${key}". Props are readonly.`);
      return false;
    }
    return true;
  },
};
