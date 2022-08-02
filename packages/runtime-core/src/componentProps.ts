import { toRaw } from "@vue/reactivity";
import {
  camelize,
  def,
  EMPTY_ARR,
  EMPTY_OBJ,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isReservedProp,
} from "@vue/shared";
import { isEmitListener } from "./componentEmits";
import { InternalObjectKey } from "./vnode";

export function initProps(
  instance,
  rawProps,
  isStateful: number, // result of bitwise flag comparison
  isSSR = false
) {
  const props = {};
  const attrs = {};
  def(attrs, InternalObjectKey, 1);
  instance.propsDefaults = Object.create(null);
  setFullProps(instance, rawProps, props, attrs);
  // ensure all declared prop keys are present
  // 过滤一下props

  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = undefined
    }
  }
  if (isStateful) {
    // stateful
    instance.props = props
    // instance.props = shallowReactive(props) // props为响应式 但是内层变化 无法发页面更新
  } 
  // 函数式 暂不考虑 用的不多
  else {
    if (!instance.type.props) {
      // functional w/ optional props, props === attrs
      instance.props = attrs
    } else {
      // functional w/ declared props
      instance.props = props
    }
  }
  instance.attrs = attrs
}

function setFullProps(instance, rawProps, props, attrs) {
  // options: props集合
  // address: {0: false, 1: true, type: ƒ}
  // age: {0: false, 1: true, type: ƒ}
  // count: {0: true, 1: false, type: Array(3)}
  // flag: {0: true, 1: true, type: ƒ}
  // params: {0: false, 1: true, type: ƒ, default: ƒ}

  // needCastKeys:
  // 有布尔值和有默认值default的key集合 ["params", "count", "flag"]
  const [options, needCastKeys] = instance.propsOptions; // 处理的
  let hasAttrsChanged = false;
  let rawCastValues;
  if (rawProps) {
    for (let key in rawProps) {
      // key, ref are reserved and never passed down
      // 排除一些特别值 key之类的
      if (isReservedProp(key)) {
        continue;
      }
      const value = rawProps[key];
      let camelKey;
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          // 除了有布尔值和有默认值default的key集合
          props[camelKey] = value;
        } else {
          // 有布尔值和有默认值default的key集合
          (rawCastValues || (rawCastValues = {}))[camelKey] = value;
        }
      }
      // 不在props但是传了 成立attrs  放到attrs里面
      else if (!isEmitListener(instance.emitsOptions, key)) {
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value;
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (needCastKeys) {
    const rawCurrentProps = toRaw(props);
    const castValues = rawCastValues || EMPTY_OBJ;
    // 盲猜给传了值的props赋值本身值  未赋值的needCastKeys中的值赋值default值
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i];
      props[key] = resolvePropValue(
        options!, // 声明的接收props
        rawCurrentProps, // 上方处理过的props 没有default和布尔类型
        key, // 有布尔值和有默认值的Key
        castValues[key], // 有布尔值和有默认值default key的value
        instance, // 组件实例
        !hasOwn(castValues, key) // 声明了属性但是没有传
      );
    }
  }
}

function resolvePropValue(
  options,
  props,
  key: string,
  value: unknown,
  instance,
  isAbsent: boolean
) {
  const opt = options[key];
  if (opt != null) {
    // 没有default不做处理
    const hasDefault = hasOwn(opt, "default");
    // default values
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default;
      if (opt.type !== Function && isFunction(defaultValue)) {
        const { propsDefaults } = instance;
        if (key in propsDefaults) {
          value = propsDefaults[key];
        } else {
          // setCurrentInstance(instance)
          value = propsDefaults[key] = defaultValue.call(null, props);
          // unsetCurrentInstance()
        }
      } else {
        value = defaultValue;
      }
      // boolean casting
      if (opt[BooleanFlags.shouldCast]) {
        // 声明了但是没传 并且 这个值没有default  直接赋值false默认值
        if (isAbsent && !hasDefault) {
          value = false;
        } else if (
          opt[BooleanFlags.shouldCastTrue] &&
          (value === "" || value === hyphenate(key))
        ) {
          value = true;
        }
      }
    }
  }
  return value;
}

function validatePropName(key: string) {
  if (key[0] !== "$") {
    return true;
  }
  return false;
}

// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor): string {
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
  return match ? match[1] : ctor === null ? "null" : "";
}

function isSameType(a, b): boolean {
  return getType(a) === getType(b);
}

function getTypeIndex(type, expectedTypes): number {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex((t) => isSameType(t, type));
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1;
  }
  return -1;
}

const enum BooleanFlags {
  shouldCast,
  shouldCastTrue,
}

export function normalizePropsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.propsCache;
  const cached = cache.get(comp);
  if (cached) {
    return cached;
  }
  // 例:
  // props:{
  // params: {
  //   type: Object,
  //   default: ()=>{},
  // },
  //   address: String,
  //   age: Number,
  //   count: [String, Number]
  // },
  const raw = comp.props;
  const normalized = {}; // 规范化驼峰命名的Key为props里的key（address） value为（）
  const needCastKeys = [];
  // apply mixin/extends props
  let hasExtends = false;
  if (!raw && !hasExtends) {
    cache.set(comp, EMPTY_ARR as any);
    return EMPTY_ARR as any;
  }
  // raw就是组件的props  先不考虑处理数组情况 考虑对象吧 用的多
  for (const key in raw) {
    const normalizedKey = camelize(key);
    // 补充完整props的type
    if (validatePropName(normalizedKey)) {
      const opt = raw[key]; // props的类型 String Object这种(String Object这种本身也是函数)
      const prop = (normalized[normalizedKey] =
        isArray(opt) || isFunction(opt) ? { type: opt } : opt); // prop: 为 count: {type: Array(2)}
      if (prop) {
        const booleanIndex = getTypeIndex(Boolean, prop.type);
        const stringIndex = getTypeIndex(String, prop.type);
        prop[BooleanFlags.shouldCast] = booleanIndex > -1;
        prop[BooleanFlags.shouldCastTrue] =
          stringIndex < 0 || booleanIndex < stringIndex;
        // if the prop needs boolean casting or default value
        if (booleanIndex > -1 || hasOwn(prop, "default")) {
          needCastKeys.push(normalizedKey);
        }
      }
    }
  }
  const res = [normalized, needCastKeys];
  cache.set(comp, res);
  return res;
}
