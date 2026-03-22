import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const TOKEN_KEY = 'newcar_token';

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(TOKEN_KEY)?.value;

  if (!token) {
    redirect('/login');
  }

  return <>{children}</>;
}
