import type { Metadata } from 'next';
import { playfair, inter } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'NewCar Journey',
  description: 'AI 原生购车工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme')||'orange';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`
        }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
