import { useEffect, useRef } from 'react';
import { translator } from './i18n';
export function useUnsaved(dirty: boolean) {
  const guard = useRef(dirty);
  guard.current = dirty;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (guard.current) e.preventDefault();
    };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (
        !guard.current ||
        !link ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        link.getAttribute('target') === '_blank' ||
        link.hasAttribute('download')
      )
        return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (
        !confirm(
          translator(document.documentElement.lang.startsWith('zh') ? 'zh-CN' : 'en-US')(
            'common.unsaved',
          ),
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('click', navigate, true);
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      document.removeEventListener('click', navigate, true);
    };
  }, []);
  return () => {
    guard.current = false;
  };
}
