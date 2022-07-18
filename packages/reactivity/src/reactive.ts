import type { UnwrapRefSimple, Ref, } from './ref'
import { isObject, toRawType, def } from '@vue/shared'
import {
  mutableHandlers,
} from './baseHandlers'
import {
  mutableCollectionHandlers,
} from './collectionHandlers'


export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()

const enum TargetType {
  INVALID = 0, // 无效
  COMMON = 1, // 常见
  COLLECTION = 2 // 集合
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: Object) {
  if (isReadonly(target)) {
    return target
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  )
}


function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
){
  if (!isObject(target)) {
    return target
  }
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  // proxyMap中存入过target 直接返回不必再做处理
  // let obj = { test: 'example' }
  // const a = reactive(obj)
  // const b = reactive(obj)
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 匹配targetType 匹配可以观测的数据类型
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )

  // 当前对象存入proxyMap(WeapMap)中 key: target; value: target处理后的proxy   
  proxyMap.set(target, proxy)
  return proxy
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}