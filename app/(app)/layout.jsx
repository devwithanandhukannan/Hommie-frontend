'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Shell from '@/components/Shell';
import { Spinner } from '@/components/ui';

export default function AppLayout({ children }) {
  const { status, family, families } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'anon') router.replace('/login');
    else if (status === 'authed' && !families.length) router.replace('/onboarding');
  }, [status, families, router]);
  if (status !== 'authed' || !family) return <Spinner />;
  return <Shell>{children}</Shell>;
}
