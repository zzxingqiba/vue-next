import {
  isString,
  hyphenate,
  capitalize,
  isArray,
  camelize,
} from "@vue/shared";

type Style = string | Record<string, string | string[]> | null;

export function patchStyle(el: Element, prev: Style, next: Style) {
  const style = (el as HTMLElement).style;
  const isCssString = isString(next);
  // 新style存在并style不是字符串
  if (next && !isCssString) {
    for (const key in next) {
      setStyle(style, key, next[key]);
    }
    // 如果之前存在style并且之前不是字符串形式
    if (prev && !isString(prev)) {
      // 之前有 现在没有 移除style
      for (const key in prev) {
        if (next[key] == null) {
          setStyle(style, key, "");
        }
      }
    }
  } else {
    // ## 未知 为了给v-show用的应该 单独处理
    const currentDisplay = style.display;
    if (isCssString) {
      // 是字符串 新旧对比不一致 直接替换
      if (prev !== next) {
        style.cssText = next as string;
      }
    } else if (prev) {
      // 之前存在 现在不存在 移除掉
      el.removeAttribute("style");
    }
    // indicates that the `display` of the element is controlled by `v-show`,
    // so we always keep the current `display` value regardless of the `style`
    // value, thus handing over control to `v-show`.
    if ("_vod" in el) {
      style.display = currentDisplay;
    }
  }
}

const importantRE = /\s*!important$/;

function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[]
) {
  if (isArray(val)) {
    val.forEach((v) => setStyle(style, name, v));
  } else {
    if (val == null) val = "";
    if (name.startsWith("--")) {
      // custom property definition
      style.setProperty(name, val);
    } else {
      const prefixed = autoPrefix(style, name);
      if (importantRE.test(val)) {
        // !important
        style.setProperty(
          hyphenate(prefixed),
          val.replace(importantRE, ""),
          "important"
        );
      } else {
        style[prefixed as any] = val;
      }
    }
  }
}

const prefixes = ["Webkit", "Moz", "ms"];
const prefixCache: Record<string, string> = {};

function autoPrefix(style: CSSStyleDeclaration, rawName: string): string {
  const cached = prefixCache[rawName];
  if (cached) {
    return cached;
  }
  let name = camelize(rawName);
  if (name !== "filter" && name in style) {
    return (prefixCache[rawName] = name);
  }
  name = capitalize(name);
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name;
    if (prefixed in style) {
      return (prefixCache[rawName] = prefixed);
    }
  }
  return rawName;
}
