'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { login, checkCaptcha } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaId] = useState('');
  const [captchaVerified] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
      return;
    }

    checkCaptcha().then(res => {
      if (res.code === 0 && res.data) {
        setCaptchaEnabled(true);
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    if (captchaEnabled && !captchaVerified) {
      toast.error('请先完成验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await login({ username, password, captchaId });
      if (res.code === 0) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role_id', res.data.role_id.toString());
        localStorage.setItem('name', res.data.name);
        localStorage.setItem('admin', (res.data.role_id === 0).toString());

        toast.success('登录成功');

        if (res.data.requirePasswordChange) {
          router.push('/change-password');
        } else {
          router.push('/dashboard');
        }
      } else {
        toast.error(res.msg || '登录失败');
      }
    } catch {
      toast.error('网络请求失败');
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
