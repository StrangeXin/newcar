import { Locale } from '@newcar/shared';
import { describe, expect, it } from 'vitest';
import { resolveLocale, resolveLocaleFromUserSettings, t } from '../src/lib/i18n';

describe('i18n', () => {
  it('should resolve locale from Accept-Language header', () => {
    expect(resolveLocale('en-US,en;q=0.9')).toBe(Locale.EN_US);
    expect(resolveLocale('zh-CN,zh;q=0.9')).toBe(Locale.ZH_CN);
    expect(resolveLocale(undefined)).toBe(Locale.ZH_CN);
  });

  it('should prioritize locale in user settings', () => {
    const settings = { locale: Locale.EN_US };
    expect(resolveLocaleFromUserSettings(settings, 'zh-CN')).toBe(Locale.EN_US);
  });

  it('should interpolate variables', () => {
    const text = t(Locale.EN_US, 'attention.priceDrop', { percent: 7 });
    expect(text).toBe('Price dropped by 7%');
  });
});
