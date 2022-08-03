import { ShapeFlags } from "@vue/shared";
import { normalizeVNode } from "./vnode";

export function renderComponentRoot(instance) {
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    data,
    setupState,
    ctx,
    inheritAttrs,
  } = instance;
  let result;
  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    // withProxy is a proxy with a different `has` trap only for
    // runtime-compiled render functions using `with` block.
    const proxyToUse = withProxy || proxy;
    result = normalizeVNode(
      render!.call(
        proxyToUse,
        proxyToUse!,
        renderCache,
        props,
        setupState,
        data,
        ctx
      )
    );
  }
  return result;
}
