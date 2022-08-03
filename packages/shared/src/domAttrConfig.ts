import { makeMap } from "./makeMap";

/**
 * On the client we only need to offer special cases for boolean attributes that
 * have different names from their corresponding dom properties:
 * - itemscope -> N/A
 * - allowfullscreen -> allowFullscreen
 * - formnovalidate -> formNoValidate
 * - ismap -> isMap
 * - nomodule -> noModule
 * - novalidate -> noValidate
 * - readonly -> readOnly
 */
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
export const isSpecialBooleanAttr = /*#__PURE__*/ makeMap(specialBooleanAttrs);

/**
 * Boolean attributes should be included if the value is truthy or ''.
 * e.g. `<select multiple>` compiles to `{ multiple: '' }`
 */
export function includeBooleanAttr(value: unknown): boolean {
  return !!value || value === "";
}
