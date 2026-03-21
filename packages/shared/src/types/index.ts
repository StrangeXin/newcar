export enum JourneyStage {
  AWARENESS = 'AWARENESS',
  CONSIDERATION = 'CONSIDERATION',
  COMPARISON = 'COMPARISON',
  DECISION = 'DECISION',
  PURCHASE = 'PURCHASE',
}

export enum JourneyStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum UserRole {
  MEMBER = 'MEMBER',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN',
}

export enum Platform {
  WEB = 'WEB',
  WECHAT_MINIAPP = 'WECHAT_MINIAPP',
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export enum Locale {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US',
}

export enum BehaviorEventType {
  PAGE_VIEW = 'PAGE_VIEW',
  CAR_VIEW = 'CAR_VIEW',
  SPEC_TAB = 'SPEC_TAB',
  REVIEW_READ = 'REVIEW_READ',
  COMPARISON_OPEN = 'COMPARISON_OPEN',
  PRICE_CHECK = 'PRICE_CHECK',
  VIDEO_WATCH = 'VIDEO_WATCH',
  DEALER_LOCATE = 'DEALER_LOCATE',
  COMMUNITY_POST_VIEW = 'COMMUNITY_POST_VIEW',
}

export enum PublishedFormat {
  STORY = 'story',
  REPORT = 'report',
  TEMPLATE = 'template',
}
