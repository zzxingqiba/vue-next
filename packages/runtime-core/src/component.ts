import { markRaw, proxyRefs } from "@vue/reactivity";
import { EMPTY_OBJ, extend, isFunction, isObject, NOOP, ShapeFlags } from "@vue/shared";
import { pauseTracking, resetTracking } from "packages/reactivity/src/effect";
import { createAppContext } from "./apiCreateApp";
import { applyOptions } from "./componentOptions";
import {
  emit,
} from './componentEmits'
import { initProps, normalizePropsOptions } from "./componentProps";
import { PublicInstanceProxyHandlers } from "./componentPublicInstance";
import { callWithErrorHandling } from "./errorHandling";
import { initSlots } from "./componentSlots";

export function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT;
}

export function setupComponent(instance, isSSR = false) {
  const { props, children } = instance.vnode;
  const isStateful = isStatefulComponent(instance);
  initProps(instance, props, isStateful, isSSR);
  initSlots(instance, children)

  const setupResult = isStateful
    ? setupStatefulComponent(instance)
    : undefined;
  return setupResult;
}

function setupStatefulComponent(instance) {
  const Component = instance.type;
  // 0. create render proxy property access cache
  instance.accessCache = Object.create(null);
  // 1. create public instance / render proxy
  // also mark it raw so it's never observed
  // markRaw不观察instance.proxy
  // @ts-ignore
  instance.proxy = markRaw(
    new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  );

  // 2. call setup()
  // 传setup暂不考虑
  const { setup } = Component;
  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null);
    setCurrentInstance(instance);
    pauseTracking();
    const setupResult = callWithErrorHandling(setup, instance, null, [
      instance.props,
      setupContext,
    ]);
    resetTracking();
    unsetCurrentInstance();
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance);
  }
}

export function createSetupContext(instance) {
  const expose = (exposed) => {
    instance.exposed = exposed || {};
  };
  let attrs;
  return {
    get attrs() {
      return attrs || (attrs = createAttrsProxy(instance));
    },
    slots: instance.slots,
    emit: instance.emit,
    expose,
  };
}

function createAttrsProxy(instance) {
  return new Proxy(instance.attrs, {
    get(target, key: string) {
      return target[key];
    },
  });
}

export function handleSetupResult(
  instance,
  setupResult: unknown,
){
  if (isFunction(setupResult)) {
    // setup返回函数形式 以返回render为准 不看type中的render
    instance.render = setupResult
  } else if (isObject(setupResult)){
    // 将setup返回的对象去除ref .value的形式直接访问 并挂载到instance实例上
    instance.setupState = proxyRefs(setupResult)
  }
  finishComponentSetup(instance)
}

let compile;
let installWithProxy;
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile;
  installWithProxy = (i) => {
    if (i.render!._rc) {
      // i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers)
    }
  };
}

export function finishComponentSetup(
  instance,
  isSSR = false,
  skipOptions?: boolean
) {
  const Component = instance.type;
  // template / render function normalization
  // could be already set when returned from setup()
  if (!instance.render) {
    // only do on-the-fly compile if not in SSR - SSR on-the-fly compilation
    // is done by server-renderer
    if (!isSSR && compile && !Component.render) {
      const template = Component.template;
      if (template) {
        const { isCustomElement, compilerOptions } = instance.appContext.config;
        const { delimiters, compilerOptions: componentCompilerOptions } =
          Component;
        const finalCompilerOptions = extend(
          extend(
            {
              isCustomElement,
              delimiters,
            },
            compilerOptions
          ),
          componentCompilerOptions
        );
        Component.render = compile(template, finalCompilerOptions);
      }
    }

    instance.render = Component.render || NOOP;
    if (installWithProxy) {
      installWithProxy(instance);
    }
  }

  setCurrentInstance(instance);
  pauseTracking();
  applyOptions(instance);
  resetTracking();
  unsetCurrentInstance();
}

let currentInstance = null;
export const setCurrentInstance = (instance) => {
  currentInstance = instance;
  instance?.scope?.on?.();
};

export const unsetCurrentInstance = () => {
  currentInstance && currentInstance?.scope?.off?.();
  currentInstance = null;
};

const emptyAppContext = createAppContext();

let uid = 0;

export function createComponentInstance(vnode, parent, suspense) {
  const type = vnode.type;
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext;

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
    sp: null,
  };
  instance.ctx = { _: instance };
  instance.root = parent ? parent.root : instance;
  instance.emit = emit.bind(null, instance)

  // apply custom element special handling
  if (vnode.ce) {
    vnode.ce(instance);
  }

  return instance;
}
