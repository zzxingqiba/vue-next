import { isFunction, isObject, NO } from "@vue/shared"
import { createVNode } from './vnode'

export function createAppContext() {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap()
  }
}

let uid = 0

export function createAppAPI(
  render,
  hydrate?: any
){
  // 本质返回app对象 将一系列方法挂载到app上 最后返回了app
  // rootComponent为 rootProps为根props
  return function createApp(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      // 此处为用户外部调createApp处传进来的options
      // 例如：
      // createApp({
      //   data(){
      //     return {
      //       name: 'kk'
      //     }
      //   }
      // })
      rootComponent = { ...rootComponent } // data...
    }
    // rootProps存在rootProps要为对象形式才会生效
    if (rootProps != null && !isObject(rootProps)) {
      // __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }
    const context = createAppContext()
    const installedPlugins = new Set()

    let isMounted = false

    const app = (context.app = {
      _uid: uid++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      get config() {
        return context.config
      },

      set config(v) {
        console.warn('app.config cannot be replaced. Modify individual options instead.')
      },

      use(plugin, ...options) {},

      mixin(mixin) {},

      component(name: string, component?: any): any {},

      directive(name: string, directive?: any) {},

      mount(
        rootContainer,
        isHydrate?: boolean,
        isSVG?: boolean
      ){
        if (!isMounted) {
          // 创建虚拟节点createVNode
          const vnode = createVNode(rootComponent, rootProps)
          vnode.appContext = context
          if (isHydrate && hydrate) {
            hydrate(vnode, rootContainer as any)
          } else {
            //渲染虚拟节点为真实节点
            render(vnode, rootContainer, isSVG)
          }
          // isMounted = true
          // app._container = rootContainer
          // // for devtools and telemetry
          // ;(rootContainer as any).__vue_app__ = app
          // return getExposeProxy(vnode.component!) || vnode.component!.proxy
        }
      },

      unmount() {},

      provide(key, value) {},

    })
    
    return app
  }
}