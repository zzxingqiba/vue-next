// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.

import {
  camelize,
  EMPTY_OBJ,
  hasOwn,
  hyphenate,
  isOn,
  toHandlerKey,
} from "@vue/shared";
import { callWithAsyncErrorHandling } from "./errorHandling";

// both considered matched listeners.
export function isEmitListener(options, key: string): boolean {
  if (!options || !isOn(key)) {
    return false;
  }

  key = key.slice(2).replace(/Once$/, "");
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
    hasOwn(options, hyphenate(key)) ||
    hasOwn(options, key)
  );
}

export function emit(instance, event: string, ...rawArgs: any[]) {
  if (instance.isUnmounted) return;
  const props = instance.vnode.props || EMPTY_OBJ;

  let args = rawArgs;

  let handlerName;
  let handler =
    props[(handlerName = toHandlerKey(event))] ||
    // also try camelCase event handler (#2249)
    props[(handlerName = toHandlerKey(camelize(event)))];

  if (handler) {
    callWithAsyncErrorHandling(handler, args);
  }
}
