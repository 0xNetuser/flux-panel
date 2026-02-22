'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { login, checkCaptchaEnabled, generateCaptcha } from '@/lib/api/auth';
import { useTranslation } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
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
      toast.error(t('login.pleaseEnterCredentials'));
      return;
    }

    if (captchaEnabled && !captchaAnswer) {
      toast.error(t('login.pleaseEnterCaptcha'));
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

        toast.success(t('login.loginSuccess'));

        if (res.data.requirePasswordChange) {
          router.push('/change-password');
        } else {
          router.push('/dashboard');
        }
      } else {
        toast.error(res.msg || t('login.loginFailed'));
        if (captchaEnabled) {
          refreshCaptcha();
        }
      }
    } catch {
      toast.error(t('common.networkError'));
      if (captchaEnabled) {
        refreshCaptcha();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="text-2xl font-semibold">{t('login.title')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('login.username')}</Label>
              <Input
                id="username"
                placeholder={t('login.enterUsername')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('login.enterPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {captchaEnabled && captchaImage && (
              <div className="space-y-2">
                <Label htmlFor="captcha">{t('login.captcha')}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="captcha"
                    placeholder={t('login.enterCaptcha')}
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="flex-1"
                  />
                  <img
                    src={captchaImage}
                    alt={t('login.captchaAlt')}
                    className="h-10 cursor-pointer rounded border"
                    onClick={refreshCaptcha}
                    title={t('login.clickRefreshCaptcha')}
                  />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
