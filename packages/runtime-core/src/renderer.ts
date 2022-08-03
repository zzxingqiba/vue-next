import {
  Text,
  Fragment,
  Comment,
  VNode,
  isSameVNodeType,
  Static,
  normalizeVNode,
  cloneIfMounted,
} from "./vnode";
import {
  EMPTY_ARR,
  EMPTY_OBJ,
  isReservedProp,
  NOOP,
  PatchFlags,
  ShapeFlags,
} from "@vue/shared";
import { createAppAPI } from "./apiCreateApp";
import { createComponentInstance, setupComponent } from "./component";
import { getSequence } from "./getSequence";
import { renderComponentRoot } from "./componentRenderUtils";
import { ReactiveEffect } from "@vue/reactivity";
import { queueJob, SchedulerJob } from "./scheduler";

export function createRenderer(options: any) {
  return baseCreateRenderer(options);
}

function toggleRecurse({ effect, update }, allowed: boolean) {
  effect.allowRecurse = update.allowRecurse = allowed;
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
    insertStaticContent: hostInsertStaticContent,
  } = options;

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
      return;
    }
    // patching & not same type, unmount old tree
    // 旧节点存在  新旧节点不一致  移除旧节点 置为null 就会走挂载逻辑生成新的节点
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1);
      unmount(n1, parentComponent, parentSuspense, true);
      n1 = null;
    }
    // ##未知 diff优化
    if (n2.patchFlag === PatchFlags.BAIL) {
      optimized = false;
      n2.dynamicChildren = null;
    }
    const { type, ref, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor);
        break;
      case Comment:
        // processCommentNode(n1, n2, container, anchor)
        break;
      case Static:
        // if (n1 == null) {
        //   mountStaticNode(n2, container, anchor, isSVG)
        // }
        break;
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
        break;
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
          );
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
          );
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
  };

  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent,
    parentSuspense,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    const el = (n2.el = n1.el!);

    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    const areChildrenSVG = isSVG && n2.type !== "foreignObject";
    // full diff
    // 比较并更新孩子节点 全量diff
    patchChildren(
      n1,
      n2,
      el,
      null,
      parentComponent,
      parentSuspense,
      areChildrenSVG,
      slotScopeIds,
      false
    );

    // unoptimized, full diff
    // 比较并更新属性 未优化 全量diff
    patchProps(
      el,
      n2,
      oldProps,
      newProps,
      parentComponent,
      parentSuspense,
      isSVG
    );
  };

  const patchChildren = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds,
    optimized = false
  ) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = n2.children;
    const { patchFlag, shapeFlag } = n2;

    // children has 3 possibilities: text, array or no children.
    // 新旧子节点出现可能为 (空、数组、文本) 9种情况
    //✅  pos        旧         新          操作
    //✅   1         文本       空          清空
    //✅   2         文本       文本        对比 不同则设置文本
    //✅   3         文本       数组        清空 创建节点
    //✅   4         数组       空          卸载旧节点
    //✅   5         数组       文本        卸载旧节点 设置文本
    //✅   6         数组       数组        diff
    //✅   7         空         空          忽略
    //✅   8         空         文本        设置文本
    //✅   9         空         数组        创建节点

    // 新节点为文本节点 2 5 8
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 5 (进行了一部优化 普通的并未遍历删除 而是直接走了hostSetElementText替换为文字 也达到删除效果)
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1, parentComponent, parentSuspense);
      }
      // 2 5 8
      if (c1 != c2) {
        hostSetElementText(container, c2 as string);
      }
    }
    // 新节点为空或数组
    else {
      // 旧节点为数组 4 6
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 6 同为数组 需diff
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 有key值比较
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          );
        } else {
          // no new children, just unmount old
          // 4
          unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true);
        }
      }
      // 1 3 7(忽略) 9
      // 旧节点为空或文本 新节点为 数组 文本 空(忽略)
      else {
        // 1 3
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, "");
        }
        // 3 9
        // mount new if array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          );
        }
      }
    }
  };

  // can be all-keyed or mixed
  const patchKeyedChildren = (
    c1,
    c2,
    container,
    parentAnchor,
    parentComponent,
    parentSuspense,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    let i = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1; // prev ending index
    let e2 = l2 - 1; // next ending index

    // 1. sync from start
    // (a b) c
    // (a b) d e
    // 从前面开始比对
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = (c2[i] = optimized
        ? cloneIfMounted(c2[i])
        : normalizeVNode(c2[i]));
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      } else {
        break;
      }
      i++;
    }

    // 2. sync from end
    // a (b c)
    // d e (b c)
    // 从后面开始比对
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = (c2[e2] = optimized
        ? cloneIfMounted(c2[e2])
        : normalizeVNode(c2[e2]));
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      } else {
        break;
      }
      e1--;
      e2--;
    }

    // 3. common sequence + mount
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    // 归纳得出结论 完美情况 新节点与旧节点比对相同 新节点要多(无论多在前后) 使用i > e1判断
    // 都要去取i至e2处进行挂载
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1;
        // 因为要将新节点进行插入 第二种情况nextPos一定小于新子节点的总长 这样可以取到c旁的a 以a为基准进行插入  反之第一种右侧一定为空
        const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
        while (i <= e2) {
          patch(
            null,
            (c2[i] = optimized
              ? cloneIfMounted(c2[i] as VNode)
              : normalizeVNode(c2[i])),
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          );
          i++;
        }
      }
    }

    // 4. common sequence + unmount
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    // 归纳得出结论 完美情况 新节点与旧节点比对相同 旧节点要多(无论多在前后) 使用i > e2判断
    // 都要去取i至e1处进行卸载
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i], parentComponent, parentSuspense, true);
        i++;
      }
    }

    // 5. unknown sequence
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    // 乱序对比
    else {
      // 例
      // [A,B,C,D,E,F,G]
      // [A,B,E,C,D,H,F,G]
      let s1 = i;
      let s2 = i;

      // 5.1 build key:index map for newChildren
      const keyToNewIndexMap = new Map();
      // 新节点建立key key  value index的映射关系
      for (let i = s2; i <= e2; i++) {
        keyToNewIndexMap.set(c2[i].key, i);
      }
      // keyToNewIndexMap: [E:2, C:3, D:4, H:5]

      const toBePatch = e2 - s2 + 1; // 新节点总个数
      const newIndexToOldIndexMap = new Array(toBePatch).fill(0); // 长度为新节点个数 记录值为旧节点索引+1  目的为判断是否比对过 未比对过则是新增 为0
      let moved = false;
      // used to track whether any node has moved
      let maxNewIndexSoFar = 0;

      // 5.2 loop through old children left to be patched and try to patch
      // matching nodes & remove nodes that are no longer present
      // 循环旧元素 看一下新的里边是否存在 不存在则删除 存在则对比
      for (let i = s1; i <= e1; i++) {
        const oldChild = c1[i]; // 旧节点
        let newIndex = keyToNewIndexMap.get(oldChild.key);
        if (newIndex) {
          newIndexToOldIndexMap[newIndex - s2] = i + 1; // 0为添加 防止初始为0情况 所以全部+1基础 为了找到递增序列 +1无影响 不关心数值 因为索引位置是不变的 最后用索引
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          patch(oldChild, c2[newIndex], container);
        } else {
          unmount(oldChild, parentComponent, parentSuspense, true);
        }
      }
      // newIndexToOldIndexMap: [4, 2, 3, 0] (+ 1) => [5, 3, 4, 0]

      // 5.3 move and mount
      // generate longest stable subsequence only when nodes have moved

      // 5.3.1 未做任何优化情况
      /**
       * // 需移动位置  上面只是比对而已  实际的vonde的el并没有移动
         // 倒序遍历 以便插入 遍历节点长度次数即可 初始值应为长度-1 代表索引
         for (let i = toBePatch - 1; i >= 0; i--) {
           let index = i + s2; // 新节点索引位置  长度所在位置 + s2
           let current = c2[index]; // 当前节点
           let anchor = index + 1 < c2.length ? c2[index + 1].el : null; // 找到参照节点 没找到则是appendChild 找到插在前面
           if (newIndexToOldIndexMap[i] == 0) {
             patch(null, current, container, anchor);
           } else {
             // 比对完 vode一定有el了
             hostInsert(current.el, container, anchor);
           }
         }
       */

      // 5.3.2 最长递增子序列优化
      // 仅当节点移动时生成最长稳定子序列
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : EMPTY_ARR;
      // increasingNewIndexSequence: [1, 2] 递增索引 虽然之前+1 但是只关心递增不关心原先数值

      let j = increasingNewIndexSequence.length - 1;
      // 倒序遍历 以便插入 遍历节点长度次数即可 初始值应为长度-1 代表索引
      for (i = toBePatch - 1; i >= 0; i--) {
        const nextIndex = s2 + i;
        const nextChild = c2[nextIndex];
        const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor; // 找到参照节点
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, anchor);
        } else if (moved) {
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            hostInsert(nextChild.el, container, anchor);
          } else {
            j--;
          }
        }
      }
    }
  };

  const patchProps = (
    el,
    vnode,
    oldProps,
    newProps,
    parentComponent,
    parentSuspense,
    isSVG: boolean
  ) => {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        // empty string is not valid prop
        if (isReservedProp(key)) continue;
        const next = newProps[key];
        const prev = oldProps[key];
        // defer patching value
        // 对比props class style attrs event相关
        if (next !== prev && key !== "value") {
          hostPatchProp(
            el,
            key,
            prev,
            next,
            isSVG,
            vnode.children as VNode[],
            parentComponent,
            parentSuspense,
            unmountChildren
          );
        }
      }
      // 移除旧节点未在新节点中的属性
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            hostPatchProp(
              el,
              key,
              oldProps[key],
              null,
              isSVG,
              vnode.children as VNode[],
              parentComponent,
              parentSuspense,
              unmountChildren
            );
          }
        }
      }
      if ("value" in newProps) {
        hostPatchProp(el, "value", oldProps.value, newProps.value);
      }
    }
  };

  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateText(n2.children as string)),
        container,
        anchor
      );
    } else {
      const el = (n2.el = n1.el!);
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string);
      }
    }
  };

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
    isSVG = isSVG || (n2.type as string) === "svg";
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
      );
    } else {
      patchElement(
        n1,
        n2,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
    }
  };

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
    n2.slotScopeIds = slotScopeIds;
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
        );
      }
    } else {
      // updateComponent(n1, n2, optimized)
    }
  };

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
    let el;
    let vnodeHook;
    const { type, props, shapeFlag } = vnode;
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
    );
    // 在vnode处理时 将当前节点与孩子类型做了 | 运算
    // 此时验证当前节点孩子为文本节点 使用 & 运算
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 如果孩子节点为数组时
      mountChildren(
        vnode.children,
        el,
        null,
        parentComponent,
        parentSuspense,
        isSVG && type !== "foreignObject",
        slotScopeIds,
        optimized
      );
    }
    if (props) {
      for (const key in props) {
        if (key !== "value" && !isReservedProp(key)) {
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
          );
        }
      }

      if ("value" in props) {
        hostPatchProp(el, "value", null, props.value);
      }
    }
    // }
    hostInsert(el, container, anchor);
  };

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
      const child = (children[i] = normalizeVNode(children[i]));
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
      );
    }
  };

  const mountComponent = (
    initialVNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized
  ) => {
    // 创建一个实例
    const instance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    ));
    // 给实例赋值
    setupComponent(instance);
    // 创建一个effect
    setupRenderEffect(
      instance,
      initialVNode,
      container,
      anchor,
      parentSuspense,
      isSVG,
      optimized
    );
  };

  const setupRenderEffect = (
    instance,
    initialVNode,
    container,
    anchor,
    parentSuspense,
    isSVG,
    optimized
  ) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const subTree = (instance.subTree = renderComponentRoot(instance));
        patch(
          null,
          subTree,
          container,
          anchor,
          instance,
          parentSuspense,
          isSVG
        );
        initialVNode.el = subTree.el;
        instance.isMounted = true;
      } else {
        const nextTree = renderComponentRoot(instance);
        const prevTree = instance.subTree;
        instance.subTree = nextTree;
        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a teleport
          hostParentNode(prevTree.el!)!,
          // anchor may have changed if it's in a fragment
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          isSVG
        );
      }
    };
    // create reactive effect for rendering
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update),
      instance.scope // track it in component's effect scope
    ));

    const update: SchedulerJob = (instance.update = () => effect.run());
    update.id = instance.uid;
    // allowRecurse
    // #1801, #2043 component render effects should allow recursive updates
    toggleRecurse(instance, true);
    update();
  };

  const render = (vnode, container, isSVG) => {
    if (vnode == null) {
      if (container._vnode) {
        // 卸载节点
        unmount(container._vnode, null, null, true);
      }
    } else {
      // 初次simple情况
      // container._vnode null
      // vnode { ...乱七八糟 }
      // container 经外层mount()处理过的挂载根节点
      patch(
        container._vnode || null,
        vnode,
        container,
        null,
        null,
        null,
        isSVG
      );
    }
    // flushPostFlushCbs()
    container._vnode = vnode;
  };

  const unmountChildren = (
    children,
    parentComponent,
    parentSuspense,
    doRemove = false,
    optimized = false,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      unmount(
        children[i],
        parentComponent,
        parentSuspense,
        doRemove,
        optimized
      );
    }
  };

  const unmount = (
    vnode,
    parentComponent,
    parentSuspense,
    doRemove = false,
    optimized = false
  ) => {
    // const {
    //   type,
    //   props,
    //   ref,
    //   children,
    //   dynamicChildren,
    //   shapeFlag,
    //   patchFlag,
    //   dirs
    // } = vnode
    if (doRemove) {
      remove(vnode);
    }
  };

  const remove = (vnode) => {
    const { type, el, anchor } = vnode;
    const performRemove = () => {
      hostRemove(el!);
    };
    performRemove();
  };

  const getNextHostNode = (vnode) => {
    return hostNextSibling((vnode.anchor || vnode.el)!);
  };

  return {
    render,
    hydrate: undefined,
    createApp: createAppAPI(render, undefined),
  };
}
