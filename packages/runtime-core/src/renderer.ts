import {
  Text,
  Fragment,
  Comment,
  VNode,
  isSameVNodeType,
  Static,
  normalizeVNode,
} from './vnode'
import {
  isReservedProp,
  NOOP, PatchFlags, ShapeFlags,
} from "@vue/shared";
import { createAppAPI } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';

export function createRenderer(options: any) {
  return baseCreateRenderer(options)
}

function baseCreateRenderer(options: any, createHydrationFns?: any) {
  // 更新DOM的一些方法
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    cloneNode: hostCloneNode,
    insertStaticContent: hostInsertStaticContent
  } = options

  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateText(n2.children as string)),
        container,
        anchor
      )
    } else {
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    isSVG = isSVG || (n2.type as string) === 'svg'
    if (n1 == null) {
      mountElement(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      )
    } else {
      // patchElement(
      //   n1,
      //   n2,
      //   parentComponent,
      //   parentSuspense,
      //   isSVG,
      //   slotScopeIds,
      //   optimized
      // )
    }
  }

  const mountElement = (
    vnode: VNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    let el
    let vnodeHook
    const { type, props, shapeFlag } = vnode
    // if (
    //   !__DEV__ &&
    //   vnode.el &&
    //   hostCloneNode !== undefined &&
    //   patchFlag === PatchFlags.HOISTED
    // ) {
    //   // If a vnode has non-null el, it means it's being reused.
    //   // Only static vnodes can be reused, so its mounted DOM nodes should be
    //   // exactly the same, and we can simply do a clone here.
    //   // only do this in production since cloned trees cannot be HMR updated.
    //   el = vnode.el = hostCloneNode(vnode.el)
    // }else{
    // 创建当前空白节点并将创建的节点挂载到vnode的el属性上 以便更新时做diff
    el = vnode.el = hostCreateElement(
      vnode.type as string,
      isSVG,
      props && props.is,
      props
    )
    // 在vnode处理时 将当前节点与孩子类型做了 | 运算 
    // 此时验证当前节点孩子为文本节点 使用 & 运算
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 如果孩子节点为数组时
      mountChildren(
        vnode.children,
        el,
        null,
        parentComponent,
        parentSuspense,
        isSVG && type !== 'foreignObject',
        slotScopeIds,
        optimized
      )
    }
    if (props) {
      for (const key in props) {
        if (key !== 'value' && !isReservedProp(key)) {
          hostPatchProp(
            el,
            key,
            null,
            props[key],
            isSVG,
            vnode.children as VNode[],
            parentComponent,
            parentSuspense,
            unmountChildren
          )
        }
      }
    }
    // }
    hostInsert(el, container, anchor)
  }

  const mountChildren = (
    children,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds,
    optimized,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(
        null,
        child,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      )
    }
  }

  const unmountChildren = {}

  const patch = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
    parentSuspense = null,
    isSVG = false,
    slotScopeIds = null,
    optimized = !!n2.dynamicChildren
  ) => {
    if (n1 === n2) {
      return
    }
    // patching & not same type, unmount old tree
    if (n1 && !isSameVNodeType(n1, n2)) {
      // anchor = getNextHostNode(n1)
      // unmount(n1, parentComponent, parentSuspense, true)
      // n1 = null
    }
    if (n2.patchFlag === PatchFlags.BAIL) {
      optimized = false
      n2.dynamicChildren = null
    }
    const { type, ref, shapeFlag } = n2
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Comment:
        // processCommentNode(n1, n2, container, anchor)
        break
      case Static:
        // if (n1 == null) {
        //   mountStaticNode(n2, container, anchor, isSVG)
        // } 
        break
      case Fragment:
        // processFragment(
        //   n1,
        //   n2,
        //   container,
        //   anchor,
        //   parentComponent,
        //   parentSuspense,
        //   isSVG,
        //   slotScopeIds,
        //   optimized
        // )
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // processComponent(
          //   n1,
          //   n2,
          //   container,
          //   anchor,
          //   parentComponent,
          //   parentSuspense,
          //   isSVG,
          //   slotScopeIds,
          //   optimized
          // )
        }
      // else if (shapeFlag & ShapeFlags.TELEPORT) {
      //   ;(type as typeof TeleportImpl).process(
      //     n1 as TeleportVNode,
      //     n2 as TeleportVNode,
      //     container,
      //     anchor,
      //     parentComponent,
      //     parentSuspense,
      //     isSVG,
      //     slotScopeIds,
      //     optimized,
      //     internals
      //   )
      // } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
      //   ;(type as typeof SuspenseImpl).process(
      //     n1,
      //     n2,
      //     container,
      //     anchor,
      //     parentComponent,
      //     parentSuspense,
      //     isSVG,
      //     slotScopeIds,
      //     optimized,
      //     internals
      //   )
      // }
    }
  }

  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: any,
    anchor: any | null,
    parentComponent: any | null,
    parentSuspense: any | null,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    n2.slotScopeIds = slotScopeIds
    if (n1 == null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        // ;(parentComponent!.ctx as KeepAliveContext).activate(
        //   n2,
        //   container,
        //   anchor,
        //   isSVG,
        //   optimized
        // )
      } else {
        mountComponent(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
      }
    } else {
      // updateComponent(n1, n2, optimized)
    }
  }

  const mountComponent = (
    initialVNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized
  ) => {
    const instance =
      (initialVNode.component = createComponentInstance(
        initialVNode,
        parentComponent,
        parentSuspense
      ))

    setupComponent(instance)

    // setupRenderEffect(
    //   instance,
    //   initialVNode,
    //   container,
    //   anchor,
    //   parentSuspense,
    //   isSVG,
    //   optimized
    // )
  }

  const render = (vnode, container, isSVG) => {
    if (vnode == null) {
      if (container._vnode) {
        // 卸载节点
        // unmount(container._vnode, null, null, true)
      }
    } else {
      // 初次simple情况
      // container._vnode null
      // vnode { ...乱七八糟 }
      // container 经外层mount()处理过的挂载根节点
      patch(container._vnode || null, vnode, container, null, null, null, isSVG)
    }
    // flushPostFlushCbs()
    // container._vnode = vnode
  }

  return {
    render,
    hydrate: undefined,
    createApp: createAppAPI(render, undefined)
  }
}