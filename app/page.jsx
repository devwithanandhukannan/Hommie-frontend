'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

export default function Index() {
  const { status, families } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'anon') router.replace('/login');
    if (status === 'authed') router.replace(families.length ? '/dashboard' : '/onboarding');
  }, [status, families, router]);
  return <Spinner />;
}
