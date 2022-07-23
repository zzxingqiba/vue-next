import { isFunction } from '@vue/shared'

export function callWithErrorHandling(
  fn: Function,
  instance?: any | null,
  type?: any,
  args?: unknown[]
) {
  let res
  try {
    res = args ? fn(...args) : fn()
  } catch (err) {

  }
  return res
}

export function callWithAsyncErrorHandling(
  fn: Function | Function[],
  // instance: ComponentInternalInstance | null,
  // type: ErrorTypes,
  args?: unknown[]
): any[] {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, null, null, args)
    return res
  }

  const values = []
  for (let i = 0; i < fn.length; i++) {
    values.push(callWithAsyncErrorHandling(fn[i], args))
  }
  return values
}
