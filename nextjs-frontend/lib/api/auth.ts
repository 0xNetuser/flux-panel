import { post } from './client';

export interface LoginData {
  username: string;
  password: string;
  captchaId?: string;
  captchaAnswer?: string;
}

export interface LoginResponse {
  token: string;
  role_id: number;
  name: string;
  requirePasswordChange?: boolean;
}

export const login = (data: LoginData) => post<LoginResponse>('/user/login', data);
export const updatePassword = (data: any) => post('/user/updatePassword', data);
export const checkCaptchaEnabled = () => post('/config/get', { name: 'captcha_enabled' });
export const generateCaptcha = () => post<{ captchaId: string; captchaImage: string }>('/captcha/generate');
