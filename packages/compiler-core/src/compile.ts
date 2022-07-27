
// import { isString } from "@vue/shared"
// import { baseParse } from './parse'


// we name it `baseCompile` so that higher order compilers like
// @vue/compiler-dom can export `compile` while re-exporting everything else.
export function baseCompile(
  template,
  options = {}
) {
  // const isModuleMode = options.mode === 'module'

  // const ast = isString(template) ? baseParse(template, options) : template
  // const [nodeTransforms, directiveTransforms] =
  //   getBaseTransformPreset(prefixIdentifiers)

  // if (!__BROWSER__ && options.isTS) {
  //   const { expressionPlugins } = options
  //   if (!expressionPlugins || !expressionPlugins.includes('typescript')) {
  //     options.expressionPlugins = [...(expressionPlugins || []), 'typescript']
  //   }
  // }

  // transform(
  //   ast,
  //   extend({}, options, {
  //     prefixIdentifiers,
  //     nodeTransforms: [
  //       ...nodeTransforms,
  //       ...(options.nodeTransforms || []) // user transforms
  //     ],
  //     directiveTransforms: extend(
  //       {},
  //       directiveTransforms,
  //       options.directiveTransforms || {} // user transforms
  //     )
  //   })
  // )

  // return generate(
  //   ast,
  //   extend({}, options, {
  //     prefixIdentifiers
  //   })
  // )
}
