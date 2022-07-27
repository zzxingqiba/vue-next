export {
  reactive, effect, ref, proxyRefs, isRef, toRef, toRefs,
} from "@vue/reactivity";
export { computed } from "./apiComputed";
export { watch } from "./apiWatch";
export { createRenderer } from './renderer'
// For integration with runtime compiler
export { registerRuntimeCompiler } from './component'