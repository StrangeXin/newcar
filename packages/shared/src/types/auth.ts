export interface WechatOAuthTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
}

export interface WechatUserInfo {
  openid: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  privilege?: string[];
}

export interface AuthResult {
  user: unknown;
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
  type?: 'access' | 'refresh';
}
