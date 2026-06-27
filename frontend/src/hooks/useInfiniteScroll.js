import { useEffect, useRef } from 'react';

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  loadingMore,
  rootRef,
  direction = 'down'
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: rootRef?.current || null,
        rootMargin: direction === 'up' ? '160px 0px 0px 0px' : '0px 0px 160px 0px',
        threshold: 0
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [direction, hasMore, loading, loadingMore, onLoadMore, rootRef]);

  return sentinelRef;
}