import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#121212',
        pearl: '#f7f5f2',
        ember: '#c95f2f',
        pine: '#1f5c4a',
        workspace: {
          surface: 'rgba(255, 255, 255, 0.9)',
          border: 'rgba(0, 0, 0, 0.1)',
          chipBg: '#f3f4f6',
          chipBorder: '#e5e7eb',
          chipText: '#374151',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          border: 'var(--accent-border)',
          text: 'var(--accent-text)',
        },
      },
      spacing: {
        ws6: '6px',
        ws10: '10px',
        ws14: '14px',
      },
      borderRadius: {
        'ws-sm': '8px',
        'ws-md': '10px',
        'ws-lg': '16px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(18, 18, 18, 0.08)',
        workspace: '0 2px 12px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
