import { useState, useMemo } from 'react';

/**
 * Client-side pagination for table/list views.
 * Automatically clamps the current page when items shrink
 * (e.g. after a search or delete).
 */
export function useTablePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    paged,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
