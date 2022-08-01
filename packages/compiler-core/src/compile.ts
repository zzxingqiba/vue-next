
import { isString } from "@vue/shared"
import { baseParse } from './parse'


// we name it `baseCompile` so that higher order compilers like
// @vue/compiler-dom can export `compile` while re-exporting everything else.
export function baseCompile(
  template,
  options = {}
) {
  const ast = isString(template) ? baseParse(template, options) : template
  // return generate(
  //   ast,
  //   extend({}, options, {
  //     prefixIdentifiers
  //   })
  // )
}
