import { isProxy, isRef } from "@vue/reactivity"
import { extend, isArray, isFunction, isObject, isString, normalizeClass, normalizeStyle, ShapeFlags } from "@vue/shared"
import { currentRenderingInstance, currentScopeId } from "./componentRenderContext"
import { isSuspense } from "./components/Suspense"
import { isTeleport } from "./components/Teleport"

export const Fragment = Symbol(undefined) as any as {
  __isFragment: true
  new (): {
    $props: any
  }
}
export const Text = Symbol(undefined)
export const Comment = Symbol(undefined)
export const Static = Symbol(undefined)

export interface VNode{
  key: string | number | symbol | null
  type: any
  appContext: any | null
  children: any
  // optimization only
  shapeFlag: number
  patchFlag: number
  /**
   * SFC only. This is assigned to:
   * - Slot fragment vnodes with :slotted SFC styles.
   * - Component vnodes (during patch/hydration) so that its root node can
   *   inherit the component's slotScopeIds
   * @internal
   */
  slotScopeIds: string[] | null
  el
  props
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

/**
 * @private
 */
 export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
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
  // 格式化 class 合 style 写法
  if (props) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    // props = guardReactiveProps(props)!
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      // 拷贝一份 防止待会遍历style触发响应式
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      console.log(style)
      props.style = normalizeStyle(style)
    }
  }

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

// 标示当前节点的孩子是什么类型的
export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode
  if (children == null) {
    children = null
  }  else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  }  else {
    children = String(children)
    // force teleport children to array so it can be moved around
    if (shapeFlag & ShapeFlags.TELEPORT) {
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextVNode(children as string)]
    } else {
      // 为文本时
      type = ShapeFlags.TEXT_CHILDREN
    }
  }
  // 形成vnode树
  vnode.children = children
  // 合并当前vonde与孩子的类型 以便下次验证孩子节点类型时 使用&运算符即可  2 | 4 = 6   6 & 4 = 4
  vnode.shapeFlag |= type
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

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

export function normalizeVNode(child): VNode {
  if (child == null || typeof child === 'boolean') {
    // empty placeholder
    return createVNode(Comment)
  } else if (isArray(child)) {
    // fragment
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice()
    )
  } else if (typeof child === 'object') {
    // already vnode, this should be the most common since compiled templates
    // always produce all-vnode children arrays
    return cloneIfMounted(child)
  } else {
    // strings and numbers
    return createVNode(Text, null, String(child))
  }
}

// optimized normalization for template-compiled render fns
export function cloneIfMounted(child: VNode): VNode {
  // return child.el === null || child.memo ? child : cloneVNode(child)
  return child
}