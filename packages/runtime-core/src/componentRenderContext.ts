/**
 * mark the current rendering instance for asset resolution (e.g.
 * resolveComponent, resolveDirective) during render
 */
export let currentRenderingInstance = null;
export let currentScopeId: string | null = null;

/**
 * Note: rendering calls maybe nested. The function returns the parent rendering
 * instance if present, which should be restored after the render is done:
 *
 * ```js
 * const prev = setCurrentRenderingInstance(i)
 * // ...render
 * setCurrentRenderingInstance(prev)
 * ```
 */
 export function setCurrentRenderingInstance(
  instance
) {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  currentScopeId = (instance && instance.type.__scopeId) || null
  return prev
}

/**
 * Wrap a slot function to memoize current rendering instance
 * @private compiler helper
 */
 export function withCtx(
  fn: Function,
  ctx = currentRenderingInstance,
  isNonScopedSlot?: boolean // __COMPAT__ only
) {
  if (!ctx) return fn

  // already normalized
  if ((fn as any)._n) {
    return fn
  }

  const renderFnWithContext = (...args: any[]) => {
    // If a user calls a compiled slot inside a template expression (#1745), it
    // can mess up block tracking, so by default we disable block tracking and
    // force bail out when invoking a compiled slot (indicated by the ._d flag).
    // This isn't necessary if rendering a compiled `<slot>`, so we flip the
    // ._d flag off when invoking the wrapped fn inside `renderSlot`.
    // if (renderFnWithContext._d) {
    //   setBlockTracking(-1)
    // }
    const prevInstance = setCurrentRenderingInstance(ctx)
    const res = fn(...args)
    setCurrentRenderingInstance(prevInstance)
    // if (renderFnWithContext._d) {
    //   setBlockTracking(1)
    // }
    return res
  }

  // mark normalized to avoid duplicated wrapping
  renderFnWithContext._n = true
  // mark this as compiled by default
  // this is used in vnode.ts -> normalizeChildren() to set the slot
  // rendering flag.
  renderFnWithContext._c = true
  // disable block tracking by default
  renderFnWithContext._d = true
  return renderFnWithContext
}