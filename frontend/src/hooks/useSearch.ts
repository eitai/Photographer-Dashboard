import { useState, useMemo, useRef } from 'react';

/**
 * Generic search hook. Pass items and a predicate — returns filtered list
 * plus query state for binding to an input.
 *
 * The predicate receives the item and the already-lowercased/trimmed query,
 * so callers don't need to handle that themselves.
 *
 * The predicate ref is updated on every render so it never needs to be
 * wrapped in useCallback by the caller.
 */
export function useSearch<T>(items: T[], searchFn: (item: T, query: string) => boolean) {
  const [query, setQuery] = useState('');
  const searchFnRef = useRef(searchFn);
  searchFnRef.current = searchFn;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => searchFnRef.current(item, q));
  }, [items, query]);

  return { query, setQuery, filtered };
}
