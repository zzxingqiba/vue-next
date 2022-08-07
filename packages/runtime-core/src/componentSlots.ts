import { toRaw } from "@vue/reactivity"
import { def, isArray, isFunction, ShapeFlags } from "@vue/shared"
import { withCtx } from "./componentRenderContext"
import { InternalObjectKey, normalizeVNode } from "./vnode"

const isInternalKey = (key: string) => key[0] === '_' || key === '$stable'

export const initSlots = (
  instance,
  children
) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as any)._
    if (type) {
      // users can get the shallow readonly version of the slots object through `this.$slots`,
      // we should avoid the proxy object polluting the slots of the internal instance
      instance.slots = toRaw(children as any)
      // make compiler marker non-enumerable
      def(children as any, '_', type)
    } else {
      normalizeObjectSlots(
        children as any,
        (instance.slots = {}),
        instance
      )
    }
  } else {
    instance.slots = {}
    // if (children) {
    //   normalizeVNodeSlots(instance, children)
    // }
  }
  def(instance.slots, InternalObjectKey, 1)
}

const normalizeObjectSlots = (
  rawSlots,
  slots,
  instance
) => {
  const ctx = rawSlots._ctx
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue
    const value = rawSlots[key]
    if (isFunction(value)) {
      slots[key] = normalizeSlot(key, value, ctx)
    } else if (value != null) {
      const normalized = normalizeSlotValue(value)
      slots[key] = () => normalized
    }
  }
}

const normalizeSlot = (
  key: string,
  rawSlot: Function,
  ctx
) => {
  if ((rawSlot as any)._n) {
    // already normalized - #5353
    return rawSlot
  }
  const normalized = withCtx((...args: any[]) => {
    return normalizeSlotValue(rawSlot(...args))
  }, ctx) as any
  // NOT a compiled slot
  ;(normalized as any)._c = false
  return normalized
}

const normalizeSlotValue = (value: unknown) =>
  isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value)]