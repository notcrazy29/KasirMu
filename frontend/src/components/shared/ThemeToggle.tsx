'use client';

import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-all cursor-pointer focus:outline-none flex items-center justify-center border border-slate-200 dark:border-slate-700 active:scale-95 duration-100"
      title={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4.5 w-4.5 text-amber-400 rotate-0 transition-transform duration-300" />
      ) : (
        <Moon className="h-4.5 w-4.5 text-slate-800 dark:text-slate-200 -rotate-12 transition-transform duration-300" />
      )}
    </button>
  );
}
