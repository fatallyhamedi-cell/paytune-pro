import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = { threshold: 0.7 }
) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const node = elementRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: options.threshold ?? 0.7,
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? '0px'
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [options.threshold, options.root, options.rootMargin]);

  return { elementRef, isIntersecting };
}
