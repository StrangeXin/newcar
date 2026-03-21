import axios from 'axios';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '@newcar/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { generateSessionId } from '../lib/utils';
import { otpService } from './otp.service';

export class AuthService {
  async wechatLogin(code: string) {
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wechat.appId}&secret=${config.wechat.appSecret}&code=${code}&grant_type=authorization_code`;

    const tokenResponse = await axios.get(tokenUrl);
    const { openid, access_token } = tokenResponse.data;

    if (!openid) {
      throw new Error('Failed to get openid from WeChat');
    }

    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`;
    const userInfoResponse = await axios.get(userInfoUrl);
    const wechatUser = userInfoResponse.data;

    let user = await prisma.user.findUnique({
      where: { openid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          openid,
          nickname: wechatUser.nickname,
          avatar: wechatUser.headimgurl,
        },
      });
    }

    const sessionId = generateSessionId();
    const accessToken = this.generateAccessToken(user.id, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, sessionId);

    return { user, accessToken, refreshToken };
  }

  async phoneLogin(phone: string, otp: string) {
    const isValid = await otpService.verifyOtp(phone, otp);

    if (!isValid) {
      throw new Error('Invalid OTP');
    }

    let user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { phone },
      });
    }

    const sessionId = generateSessionId();
    const accessToken = this.generateAccessToken(user.id, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, sessionId);

    return { user, accessToken, refreshToken };
  }

  async sendOtp(phone: string): Promise<{ otp: string }> {
    const otp = await otpService.generateOtp(phone);
    return { otp };
  }

  async bindSessionToUser(sessionId: string, userId: string) {
    await prisma.behaviorEvent.updateMany({
      where: { sessionId },
      data: { userId },
    });

    await prisma.conversation.updateMany({
      where: { sessionId },
      data: { userId },
    });

    return { migrated: true };
  }

  private generateAccessToken(userId: string, sessionId: string): string {
    const expiresIn = config.jwt.expiresIn as jwt.SignOptions['expiresIn'];
    return jwt.sign({ userId, sessionId, type: 'access' }, config.jwt.secret, {
      expiresIn,
    });
  }

  private generateRefreshToken(userId: string, sessionId: string): string {
    return jwt.sign({ userId, sessionId, type: 'refresh' }, config.jwt.secret, {
      expiresIn: '30d',
    });
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }
}

export const authService = new AuthService();
