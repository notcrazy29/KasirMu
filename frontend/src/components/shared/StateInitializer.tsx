'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function StateInitializer() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
}
