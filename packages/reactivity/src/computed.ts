import { ReactiveFlags, toRaw } from "./reactive";
import { DebuggerOptions, ReactiveEffect } from "./effect";
import { isFunction, NOOP } from "@vue/shared";
import { Ref, trackRefValue, triggerRefValue } from "./ref";
import { Dep } from "./dep";

declare const ComputedRefSymbol: unique symbol;
export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T;
  [ComputedRefSymbol]: true;
}
export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>;
}

export type ComputedGetter<T> = (...args: any[]) => T;
export type ComputedSetter<T> = (v: T) => void;

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<T>;
}

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined;

  private _value!: T;
  public readonly effect: ReactiveEffect<T>;

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false;

  public _dirty = true;
  public _cacheable: boolean;

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean,
    isSSR: boolean
  ) {
    // 看来本质上也是一个ReactiveEffect
    // 回顾ReactiveEffect参数 fn和调度器
    // 简述工作流程: (计算属性相当于中转站。属性握着开关 计算属性握着effect effect执行调用属性所在的计算属性函数重新返回最新值)
    // 当使用到计算属性时, 如果我们在effect中使用到了计算属性 我们会xxx(computed).value去使用 此时触发计算属性value的get(属性访问器) 与外层effect双向收集依赖（当前计算属性上也有dep）
    // 与Vue2一样 会有一个dirty标识来实现缓存 初次为ture 进入判断后置为false 并开始计算属性传入的函数 这样会计算属性与所依赖的属性进行双向收集 并将函数返回值赋值给_value作为计算属性的值去返回
    // 当计算属性所依赖的属性发生变化, 会执行计算属性初始化时创建的effect的调度器, 将dirty置为true 并且去遍历自身收集的依赖（dep）也就是计算属性的外层的effect 触发effect的run方法
    // 也就会执行effect内部函数 内部函数中有计算属性 又会走到计算属性的value访问器上 此时dirty标识为true 重新执行计算属性内部函数 得到最新值返回  界面改变
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true;
        triggerRefValue(this);
      }
    });
    this.effect.computed = this;
    this.effect.active = this._cacheable = !isSSR;
    this[ReactiveFlags.IS_READONLY] = isReadonly;
  }
  get value() {
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    const self = toRaw(this);
    trackRefValue(self);
    if (self._dirty || !self._cacheable) {
      self._dirty = false;
      self._value = self.effect.run()!;
    }
    return self._value;
  }

  set value(newValue: T) {
    this._setter(newValue);
  }
}

export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false
) {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T>;
  const onlyGetter = isFunction(getterOrOptions);
  // 区分对象参数以及函数参数
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = NOOP;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  // 只算属性的类型为ComoutedRefImpl哦  找到ComputedRefImpl 看看内部做了什么
  const cRef = new ComputedRefImpl(
    getter,
    setter,
    onlyGetter || !setter,
    isSSR
  );
  return cRef as any;
}
