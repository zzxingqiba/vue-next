import { registerRuntimeCompiler } from '@vue/runtime-dom'
import { extend, isString, NOOP } from '@vue/shared'
import { compile } from '@vue/compiler-dom'

const compileCache = Object.create(null)

function compileToFunction(
  template,
  options
){
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML
    } else {
      return NOOP
    }
  }
  const key = template
  const cached = compileCache[key]
  if (cached) {
    return cached
  }
  if (template[0] === '#') {
    const el = document.querySelector(template)
    template = el ? el.innerHTML : ``
  }
  // const { code } = 
  compile(
    template,
    extend(
      {
        hoistStatic: true,
        onError: undefined,
        onWarn: NOOP
      },
      options
    )
  )
}

registerRuntimeCompiler(compileToFunction)
export * from '@vue/runtime-dom'



// test
export * from '@vue/compiler-core'