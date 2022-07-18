import {
  reactive,
  ReactiveFlags,
  Target,
} from './reactive'
// import { isArray , hasOwn, toRaw} from '@vue/shared'

const get = /*#__PURE__*/ createGetter()
const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  // ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
  //   instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
  //     const arr = toRaw(this) as any
  //     for (let i = 0, l = this.length; i < l; i++) {
  //       track(arr, TrackOpTypes.GET, i + '')
  //     }
  //     // we run the method using the original args first (which may be reactive)
  //     const res = arr[key](...args)
  //     if (res === -1 || res === false) {
  //       // if that didn't work, run it again using raw values.
  //       return arr[key](...args.map(toRaw))
  //     } else {
  //       return res
  //     }
  //   }
  // })
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  // ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
  //   instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
  //     pauseTracking()
  //     const res = (toRaw(this) as any)[key].apply(this, args)
  //     resetTracking()
  //     return res
  //   }
  // })
  return instrumentations
}

function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    }
    // const targetIsArray = isArray(target)
    // if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
    //   return Reflect.get(arrayInstrumentations, key, receiver)
    // }
  }
}
export const mutableHandlers: ProxyHandler<object> = {
  get,
  // set,
  // deleteProperty,
  // has,
  // ownKeys
}