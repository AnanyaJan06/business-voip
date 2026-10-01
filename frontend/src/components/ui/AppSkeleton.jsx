import { useEffect, useState } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const nightTheme = {
  baseColor: '#1f2937',
  highlightColor: '#374151'
};

const dayTheme = {
  baseColor: '#e2e8f0',
  highlightColor: '#ffffff'
};

function AppSkeletonTheme({ children }) {
  const [isDay, setIsDay] = useState(() => (
    typeof document !== 'undefined'
      ? document.documentElement.dataset.theme === 'day'
      : false
  ));

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const checkTheme = () => {
      setIsDay(document.documentElement.dataset.theme === 'day');
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  const currentTheme = isDay ? dayTheme : nightTheme;

  return (
    <SkeletonTheme {...currentTheme}>
      {children}
    </SkeletonTheme>
  );
}

export { AppSkeletonTheme, Skeleton };
