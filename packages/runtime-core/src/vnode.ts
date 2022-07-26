import { isRef } from "@vue/reactivity"
import { isFunction, isObject, isString, ShapeFlags } from "@vue/shared"
import { currentRenderingInstance, currentScopeId } from "./componentRenderContext"
import { isSuspense } from "./components/Suspense"
import { isTeleport } from "./components/Teleport"

export const Fragment = Symbol(undefined) as any as {
  __isFragment: true
  new (): {
    $props: any
  }
}

export interface VNode{
  key: string | number | symbol | null
  appContext: any | null,
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

export const createVNode = (
  _createVNode
) as typeof _createVNode

function _createVNode(
  type,
  props = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false
): VNode{

  if (isVNode(type)) {}

  // class & style normalization.
  if (props) {}

  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : true && isSuspense(type)
    ? ShapeFlags.SUSPENSE
    : isTeleport(type)
    ? ShapeFlags.TELEPORT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0
  
    return createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      isBlockNode,
      true
    )
}

function createBaseVNode(
  type,
  props = null,
  children: unknown = null,
  patchFlag = 0,
  dynamicProps: string[] | null = null,
  shapeFlag = type === Fragment ? 0 : ShapeFlags.ELEMENT,
  isBlockNode = false,
  needFullChildrenNormalization = false
) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null
  } as VNode

  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children)
  }

  return vnode
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  
}

const normalizeKey = ({ key }: any): VNode['key'] =>
  key != null ? key : null

const normalizeRef = ({
  ref,
  ref_key,
  ref_for
})=> {
  return (
    ref != null
      ? isString(ref) || isRef(ref) || isFunction(ref)
        ? { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for }
        : ref
      : null
  ) as any
}