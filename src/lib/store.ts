import { useSyncExternalStore } from 'react'

/**
 * A ~30 line observable store. React's `useSyncExternalStore` does the heavy
 * lifting; we avoid a state-management dependency for an app this size.
 *
 * Subscribers receive the whole state object. Identity only changes on `set`,
 * so this is cheap and — unlike a naive selector implementation — impossible to
 * put into a render loop.
 */
export interface Store<T> {
  get(): T
  set(updater: T | ((prev: T) => T)): void
  subscribe(listener: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set(updater) {
      const next =
        typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater
      if (Object.is(next, state)) return
      state = next
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/** Replace one item in an array, matched by `id`. Returns a new array. */
export function patchById<T extends { id: string }>(
  list: T[],
  id: string,
  patch: Partial<T> | ((item: T) => Partial<T>),
): T[] {
  return list.map((item) =>
    item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item,
  )
}
