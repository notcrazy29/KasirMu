'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectSuperAdminLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/super-admin/login');
  }, [router]);

  return null;
}
