import {
  baseCompile,
} from '@vue/compiler-core'
import { extend } from "@vue/shared";
import { parserOptions } from './parserOptions'

export { parserOptions }

export function compile(
  template: string,
  options = {}
) {
  return baseCompile(
    template,
    extend({}, parserOptions, options, {
      // nodeTransforms: [
      //   // ignore <script> and <tag>
      //   // this is not put inside DOMNodeTransforms because that list is used
      //   // by compiler-ssr to generate vnode fallback branches
      //   ignoreSideEffectTags,
      //   ...DOMNodeTransforms,
      //   ...(options.nodeTransforms || [])
      // ],
      // directiveTransforms: extend(
      //   {},
      //   DOMDirectiveTransforms,
      //   options.directiveTransforms || {}
      // ),
      // transformHoist: __BROWSER__ ? null : stringifyStatic
    })
  )
}