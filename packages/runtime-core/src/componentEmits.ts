// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.

import { hasOwn, hyphenate, isOn } from "@vue/shared";

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
