/**
 * mark the current rendering instance for asset resolution (e.g.
 * resolveComponent, resolveDirective) during render
 */
export let currentRenderingInstance = null;
export let currentScopeId: string | null = null;
