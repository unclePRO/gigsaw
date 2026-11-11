'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FreelancerOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/freelancer/profile?setup=required');
  }, [router]);

  return null;
}
