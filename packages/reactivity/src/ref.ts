export interface Ref<T = any> {
  value: T;
}
export type UnwrapRefSimple<T> = T;

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}
