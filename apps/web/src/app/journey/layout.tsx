import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { JourneyShell } from '@/components/journey/JourneyShell';

const TOKEN_KEY = 'newcar_token';

export default async function JourneyLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(TOKEN_KEY)?.value;

  if (!token) {
    redirect('/login');
  }

  return <JourneyShell>{children}</JourneyShell>;
}
