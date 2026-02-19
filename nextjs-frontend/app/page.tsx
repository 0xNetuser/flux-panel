'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { login, checkCaptchaEnabled, generateCaptcha } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const refreshCaptcha = useCallback(async () => {
    try {
      const res = await generateCaptcha();
      if (res.code === 0 && res.data) {
        setCaptchaId(res.data.captchaId);
        setCaptchaImage(res.data.captchaImage);
        setCaptchaAnswer('');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
      return;
    }

    checkCaptchaEnabled().then(res => {
      if (res.code === 0 && res.data?.value === 'true') {
        setCaptchaEnabled(true);
      }
    });
  }, [router]);

  useEffect(() => {
    if (captchaEnabled) {
      refreshCaptcha();
    }
  }, [captchaEnabled, refreshCaptcha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    if (captchaEnabled && !captchaAnswer) {
      toast.error('请输入验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await login({
        username,
        password,
        captchaId: captchaEnabled ? captchaId : undefined,
        captchaAnswer: captchaEnabled ? captchaAnswer : undefined,
      });
      if (res.code === 0) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role_id', res.data.role_id.toString());
        localStorage.setItem('name', res.data.name);
        localStorage.setItem('admin', (res.data.role_id === 0).toString());
        localStorage.setItem('gost_enabled', (res.data.gost_enabled ?? 1).toString());
        localStorage.setItem('xray_enabled', (res.data.xray_enabled ?? 1).toString());

        toast.success('登录成功');

        if (res.data.requirePasswordChange) {
          router.push('/change-password');
        } else {
          router.push('/dashboard');
        }
      } else {
        toast.error(res.msg || '登录失败');
        if (captchaEnabled) {
          refreshCaptcha();
        }
      }
    } catch {
      toast.error('网络请求失败');
      if (captchaEnabled) {
        refreshCaptcha();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Flux Panel</CardTitle>
          <CardDescription>GOST + Xray 管理面板</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {captchaEnabled && captchaImage && (
              <div className="space-y-2">
                <Label htmlFor="captcha">验证码</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="captcha"
                    placeholder="请输入验证码"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="flex-1"
                  />
                  <img
                    src={captchaImage}
                    alt="验证码"
                    className="h-10 cursor-pointer rounded border"
                    onClick={refreshCaptcha}
                    title="点击刷新验证码"
                  />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
