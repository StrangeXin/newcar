import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NewCar Journey',
  description: 'AI 原生购车工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
