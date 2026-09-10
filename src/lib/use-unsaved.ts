import { useEffect, useRef } from 'react';
export function useUnsaved(dirty: boolean) {
  const guard = useRef(dirty);
  guard.current = dirty;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (guard.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  return () => {
    guard.current = false;
  };
}
