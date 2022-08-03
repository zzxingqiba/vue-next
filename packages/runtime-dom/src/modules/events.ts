import { hyphenate } from "@vue/shared";

export function addEventListener(el: Element, event: string, handler, options) {
  el.addEventListener(event, handler, options);
}

export function removeEventListener(
  el: Element,
  event: string,
  handler,
  options
) {
  el.removeEventListener(event, handler, options);
}

export function patchEvent(
  el,
  rawName: string,
  prevValue,
  nextValue,
  instance
) {
  // vei = vue event invokers
  // 创建事件缓存区
  const invokers = el._vei || (el._vei = {});
  const existingInvoker = invokers[rawName];
  if (nextValue && existingInvoker) {
    // patch
    // 事件存在则直接替换 无需重新绑定事件
    existingInvoker.value = nextValue;
  } else {
    // 移除on  onClick =》 click
    const [name, options] = parseName(rawName);
    if (nextValue) {
      // add
      // 添加事件
      const invoker = (invokers[rawName] = createInvoker(nextValue, instance));
      addEventListener(el, name, invoker, options);
    } else if (existingInvoker) {
      // remove
      // 移除事件并清除对应缓存
      removeEventListener(el, name, existingInvoker, options);
      invokers[rawName] = undefined;
    }
  }
}

const optionsModifierRE = /(?:Once|Passive|Capture)$/;

function parseName(name: string): [string, EventListenerOptions | undefined] {
  let options: EventListenerOptions | undefined;
  if (optionsModifierRE.test(name)) {
    options = {};
    let m;
    while ((m = name.match(optionsModifierRE))) {
      name = name.slice(0, name.length - m[0].length);
      (options as any)[m[0].toLowerCase()] = true;
    }
  }
  return [hyphenate(name.slice(2)), options];
}

function createInvoker(initialValue, instance) {
  const invoker = (e) => {
    // 执行用户传进来的函数
    invoker.value(e);
  };
  // 挂载用户传进来的函数至return出去函数的属性上
  // 每次执行的是函数属性value上的方法
  // 做到了无需每次添加事件 只需要替换value即可
  invoker.value = initialValue;
  return invoker;
}
