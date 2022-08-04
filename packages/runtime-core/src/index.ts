export {
  reactive,
  effect,
  ref,
  proxyRefs,
  isRef,
  toRef,
  toRefs,
  shallowReactive,
} from "@vue/reactivity";
export { computed } from "./apiComputed";
export { watch } from "./apiWatch";
export { createRenderer } from "./renderer";
// For integration with runtime compiler
export { registerRuntimeCompiler } from "./component";
// For raw render function users
export { h } from "./h";
// VNode types
export { Fragment, Text, Comment, Static } from "./vnode";
