'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { afterAuthPath } from '@/lib/joinFlow';

export default function Index() {
  const { status, families } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'anon') router.replace('/login');
    if (status === 'authed') router.replace(afterAuthPath(families));
  }, [status, families, router]);
  return <Spinner />;
}
