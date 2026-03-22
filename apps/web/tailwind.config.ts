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
      },
      boxShadow: {
        card: '0 8px 30px rgba(18, 18, 18, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
