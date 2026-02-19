import { post } from './client';

export interface LoginData {
  username: string;
  password: string;
  captchaId: string;
}

export interface LoginResponse {
  token: string;
  role_id: number;
  name: string;
  requirePasswordChange?: boolean;
}

export const login = (data: LoginData) => post<LoginResponse>('/user/login', data);
export const updatePassword = (data: any) => post('/user/updatePassword', data);
export const checkCaptcha = () => post('/captcha/check');
export const generateCaptcha = () => post('/captcha/generate');
export const verifyCaptcha = (data: { captchaId: string; trackData: string }) => post('/captcha/verify', data);
