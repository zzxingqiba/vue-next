import {
  Text,
  Fragment,
  Comment,
  VNode,
  isSameVNodeType,
  Static,
} from './vnode'
import {
  NOOP, PatchFlags, ShapeFlags,
} from "@vue/shared";
import { createAppAPI } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';

export function createRenderer(options:any) {
  return baseCreateRenderer(options)
}
function baseCreateRenderer(options:any, createHydrationFns?:any){
  //   const {
  //   insert: hostInsert,
  //   remove: hostRemove,
  //   patchProp: hostPatchProp,
  //   createElement: hostCreateElement,
  //   createText: hostCreateText,
  //   createComment: hostCreateComment,
  //   setText: hostSetText,
  //   setElementText: hostSetElementText,
  //   parentNode: hostParentNode,
  //   nextSibling: hostNextSibling,
  //   setScopeId: hostSetScopeId = NOOP,
  //   cloneNode: hostCloneNode,
  //   insertStaticContent: hostInsertStaticContent
  // } = options

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
        // processText(n1, n2, container, anchor)
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
          // processElement(
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
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(
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
    hydrate:undefined,
    createApp: createAppAPI(render, undefined)
  }
}