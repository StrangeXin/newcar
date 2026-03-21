import { AttentionSignalType, Locale } from '@newcar/shared';

export const DEFAULT_LOCALE = Locale.ZH_CN;

export type I18nKey =
  | 'snapshot.systemPrompt'
  | 'snapshot.fallback.narrative'
  | 'snapshot.fallback.reasoning'
  | 'snapshot.fallback.nextAction'
  | 'attention.priceDrop'
  | 'attention.priceIncrease'
  | 'attention.newReviewDefault'
  | 'attention.policyDescription'
  | 'notification.title.dynamic';

type MessageCatalog = Record<I18nKey, string> & Record<`notification.title.${AttentionSignalType}`, string>;

const CATALOG: Record<Locale, MessageCatalog> = {
  [Locale.ZH_CN]: {
    'snapshot.systemPrompt': '你是购车AI助手，负责生成用户的购车旅程摘要。',
    'snapshot.fallback.narrative': '你正在{stage}阶段，已有{count}个候选车型。',
    'snapshot.fallback.reasoning': '基于当前候选列表推荐',
    'snapshot.fallback.nextAction': '继续与AI助手对话，明确你的需求',
    'attention.priceDrop': '降价{percent}%',
    'attention.priceIncrease': '涨价{percent}%',
    'attention.newReviewDefault': '有新的评测文章',
    'attention.policyDescription': '{policyType}: 补贴{subsidyAmount}元',
    'notification.title.PRICE_DROP': '价格变动',
    'notification.title.NEW_VARIANT': '新车型发布',
    'notification.title.NEW_REVIEW': '新评测内容',
    'notification.title.POLICY_UPDATE': '政策更新',
    'notification.title.OTA_RECALL': '系统更新/召回',
    'notification.title.dynamic': '动态更新',
  },
  [Locale.EN_US]: {
    'snapshot.systemPrompt': 'You are an automotive AI assistant responsible for generating journey snapshots.',
    'snapshot.fallback.narrative': 'You are currently in the {stage} stage with {count} candidate cars.',
    'snapshot.fallback.reasoning': 'Recommended based on current candidate list',
    'snapshot.fallback.nextAction': 'Continue chatting with the AI assistant to clarify your needs',
    'attention.priceDrop': 'Price dropped by {percent}%',
    'attention.priceIncrease': 'Price increased by {percent}%',
    'attention.newReviewDefault': 'A new review is available',
    'attention.policyDescription': '{policyType}: subsidy {subsidyAmount}',
    'notification.title.PRICE_DROP': 'Price Change',
    'notification.title.NEW_VARIANT': 'New Variant Released',
    'notification.title.NEW_REVIEW': 'New Review',
    'notification.title.POLICY_UPDATE': 'Policy Update',
    'notification.title.OTA_RECALL': 'OTA/Recall Alert',
    'notification.title.dynamic': 'Update',
  },
};

export function resolveLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }
  const normalized = acceptLanguage.toLowerCase();
  if (normalized.includes('en-us') || normalized.startsWith('en')) {
    return Locale.EN_US;
  }
  return DEFAULT_LOCALE;
}

export function resolveLocaleFromUserSettings(
  notificationSettings?: unknown,
  acceptLanguage?: string | null
): Locale {
  if (notificationSettings && typeof notificationSettings === 'object' && !Array.isArray(notificationSettings)) {
    const locale = (notificationSettings as Record<string, unknown>).locale;
    if (locale === Locale.ZH_CN || locale === Locale.EN_US) {
      return locale;
    }
  }
  return resolveLocale(acceptLanguage);
}

export function t(locale: Locale, key: I18nKey | `notification.title.${AttentionSignalType}`, vars?: Record<string, string | number>): string {
  const catalog = CATALOG[locale] || CATALOG[DEFAULT_LOCALE];
  const template = catalog[key] || CATALOG[DEFAULT_LOCALE][key];
  if (!vars) {
    return template;
  }
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);
}
