import { includeBooleanAttr } from "@vue/shared";

// functions. The user is responsible for using them with only trusted content.
export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  // the following args are passed only due to potential innerHTML/textContent
  // overriding existing VNodes, in which case the old tree must be properly
  // unmounted.
  prevChildren: any,
  parentComponent: any,
  parentSuspense: any,
  unmountChildren: any
) {
  if (key === "innerHTML" || key === "textContent") {
    if (prevChildren) {
      unmountChildren(prevChildren, parentComponent, parentSuspense);
    }
    el[key] = value == null ? "" : value;
    return;
  }

  if (
    key === "value" &&
    el.tagName !== "PROGRESS" &&
    // custom elements may use _value internally
    !el.tagName.includes("-")
  ) {
    // store value as _value as well since
    // non-string values will be stringified.
    el._value = value;
    const newValue = value == null ? "" : value;
    if (
      el.value !== newValue ||
      // #4956: always set for OPTION elements because its value falls back to
      // textContent if no value attribute is present. And setting .value for
      // OPTION has no side effect
      el.tagName === "OPTION"
    ) {
      el.value = newValue;
    }
    if (value == null) {
      el.removeAttribute(key);
    }
    return;
  }

  let needRemove = false;
  if (value === "" || value == null) {
    const type = typeof el[key];
    if (type === "boolean") {
      // e.g. <select multiple> compiles to { multiple: '' }
      value = includeBooleanAttr(value);
    } else if (value == null && type === "string") {
      // e.g. <div :id="null">
      value = "";
      needRemove = true;
    } else if (type === "number") {
      // e.g. <img :width="null">
      // the value of some IDL attr must be greater than 0, e.g. input.size = 0 -> error
      value = 0;
      needRemove = true;
    }
  }

  el[key] = value;
  needRemove && el.removeAttribute(key);
}
