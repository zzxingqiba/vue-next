import {
  NOOP,
} from "@vue/shared";
import { createAppAPI } from './apiCreateApp'

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
    // if (n1 && !isSameVNodeType(n1, n2)) {
    //   anchor = getNextHostNode(n1)
    //   unmount(n1, parentComponent, parentSuspense, true)
    //   n1 = null
    // }
  }

  const render = (vnode, container, isSVG) => {
    // if (vnode == null) {
    //   if (container._vnode) {
    //     unmount(container._vnode, null, null, true)
    //   }
    // } else {
    //   patch(container._vnode || null, vnode, container, null, null, null, isSVG)
    // }
    // flushPostFlushCbs()
    // container._vnode = vnode
  }

  return {
    render,
    hydrate:undefined,
    createApp: createAppAPI(render, undefined)
  }
}