import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { StageProgress } from '@/components/journey/StageProgress';

const TOKEN_KEY = 'newcar_token';

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(TOKEN_KEY)?.value;

  if (!token) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="mx-auto hidden max-w-[1440px] gap-4 px-4 py-4 lg:flex">
        <div className="w-[240px] shrink-0">
          <StageProgress />
        </div>
        <div className="min-h-[calc(100vh-2rem)] flex-1">{children}</div>
        <div className="w-[360px] shrink-0">
          <ChatPanel />
        </div>
      </div>

      <div className="lg:hidden">
        <main>{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-4 border-t border-black/10 bg-white/95 backdrop-blur">
          <Link href="/journey" className="px-2 py-3 text-center text-xs font-semibold text-ink">
            我的旅程
          </Link>
          <button type="button" className="px-2 py-3 text-xs font-semibold text-black/60" aria-label="AI助手">
            AI助手
          </button>
          <Link href="/community" className="px-2 py-3 text-center text-xs font-semibold text-black/60">
            社区
          </Link>
          <button type="button" className="px-2 py-3 text-xs font-semibold text-black/60">
            我的
          </button>
        </nav>
      </div>
    </div>
  );
}
