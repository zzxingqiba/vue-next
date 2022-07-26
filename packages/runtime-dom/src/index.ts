import {
  createRenderer,
} from '@vue/runtime-core'
import { extend, isFunction, isString } from '@vue/shared';
import { nodeOps } from './nodeOps';
import { patchProp } from './patchProp';

const rendererOptions = /*#__PURE__*/ extend({ patchProp }, nodeOps)

let renderer:any;

function ensureRenderer() {
  return (
    renderer ||
    (renderer = createRenderer(rendererOptions))
  )
}

export const createApp = ((...args: any) => {
  const app = ensureRenderer().createApp(...args)

  const { mount } = app

  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    const container = normalizeContainer(containerOrSelector)
    if (!container) return

    const component = app._component
    // createApp没有传template或render之类的 就给个空得template 没啥用这里
    if (!isFunction(component) && !component.render && !component.template) {
      component.template = container.innerHTML
    }
    // clear content before mounting
    container.innerHTML = ''

    const proxy = mount(container, false, container instanceof SVGElement)
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }

    return proxy
  }

  return app
})

function normalizeContainer(
  container: Element | ShadowRoot | string
): Element | null {
  if (isString(container)) {
    const res = document.querySelector(container)
    return res
  }
  return container as any
}

export * from "@vue/runtime-core";
