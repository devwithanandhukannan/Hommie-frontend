'use client';

export function getSavedTheme() {
  if (typeof window === 'undefined') return 'system';
  return localStorage.getItem('fh-theme') || 'system';
}

export function applyTheme(pref) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fh-theme', pref);
  if (pref === 'system') {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', pref);
  }
}

