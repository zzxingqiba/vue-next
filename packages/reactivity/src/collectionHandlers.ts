export type CollectionTypes = IterableCollections | WeakCollections;

type IterableCollections = Map<any, any> | Set<any>;
type WeakCollections = WeakMap<any, any> | WeakSet<any>;

export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  // get: /*#__PURE__*/ createInstrumentationGetter(false, false)
};

export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  // get: /*#__PURE__*/ createInstrumentationGetter(false, true)
}