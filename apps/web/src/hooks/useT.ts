'use client';

import { useLocale } from './useLocale';
import { getMessages } from '@/lib/i18n';

export function useT() {
  const { locale } = useLocale();
  return getMessages(locale);
}
