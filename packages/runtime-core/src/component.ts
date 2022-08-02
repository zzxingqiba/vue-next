import { markRaw } from "@vue/reactivity"
import { EMPTY_OBJ, extend, NOOP, ShapeFlags } from "@vue/shared"
import { createAppContext } from "./apiCreateApp"
import { initProps, normalizePropsOptions } from "./componentProps"

export function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
}

export function setupComponent(
  instance,
  isSSR = false
) {

  const { props, children } = instance.vnode
  const isStateful = isStatefulComponent(instance)
  initProps(instance, props, isStateful, isSSR)
  // initSlots(instance, children)

  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined
  return setupResult
}

function setupStatefulComponent(
  instance,
  isSSR: boolean
) {
  const Component = instance.type
  // 0. create render proxy property access cache
  instance.accessCache = Object.create(null)
  // 1. create public instance / render proxy
  // also mark it raw so it's never observed
  // instance.proxy = markRaw(new Proxy(instance.ctx, PublicInstanceProxyHandlers))

  // 2. call setup()
  const { setup } = Component
  if (setup){

  }else{
    finishComponentSetup(instance, isSSR)
  }
}

let compile
let installWithProxy
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
  installWithProxy = i => {
    if (i.render!._rc) {
      // i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers)
    }
  }
}

export function finishComponentSetup(
  instance,
  isSSR: boolean,
  skipOptions?: boolean
){
  const Component = instance.type
  // template / render function normalization
  // could be already set when returned from setup()
  if (!instance.render) {
    // only do on-the-fly compile if not in SSR - SSR on-the-fly compilation
    // is done by server-renderer    
    if (!isSSR && compile && !Component.render) {
      const template = Component.template
      if (template) {
        const { isCustomElement, compilerOptions } = instance.appContext.config
        const { delimiters, compilerOptions: componentCompilerOptions } =
          Component
        const finalCompilerOptions = extend(
          extend(
            {
              isCustomElement,
              delimiters
            },
            compilerOptions
          ),
          componentCompilerOptions
        )
        Component.render = compile(template, finalCompilerOptions)
      }

      instance.render = (Component.render || NOOP)

      // if (installWithProxy) {
      //   installWithProxy(instance)
      // }
    }
  }
}

const emptyAppContext = createAppContext()

let uid = 0

export function createComponentInstance(
  vnode,
  parent,
  suspense
) {
  const type = vnode.type
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext

  const instance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null!, // to be immediately set
    next: null,
    subTree: null!, // will be set synchronously right after creation
    effect: null!,
    update: null!, // will be set synchronously right after creation
    // scope: new EffectScope(true /* detached */),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null!,
    renderCache: [],

    // local resolved assets
    components: null,
    directives: null,

    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    // emitsOptions: normalizeEmitsOptions(type, appContext),

    // emit
    emit: null!, // to be set immediately
    emitted: null,

    // props default value
    propsDefaults: EMPTY_OBJ,

    // inheritAttrs
    inheritAttrs: type.inheritAttrs,

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null
  }
  instance.ctx = { _: instance }
  instance.root = parent ? parent.root : instance
  // instance.emit = emit.bind(null, instance)

  // apply custom element special handling
  if (vnode.ce) {
    vnode.ce(instance)
  }

  return instance
}