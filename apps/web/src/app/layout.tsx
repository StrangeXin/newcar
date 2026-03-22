import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NewCar Journey',
  description: 'AI 原生购车工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-['Avenir_Next','Segoe_UI','Noto_Sans_SC','PingFang_SC',sans-serif] antialiased">
        {children}
      </body>
    </html>
  );
}
