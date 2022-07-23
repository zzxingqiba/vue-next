import { computed as _computed } from "@vue/reactivity";

export const computed = ((getterOrOptions: any) => {
  // @ts-ignore
  return _computed(getterOrOptions);
}) as typeof _computed;
