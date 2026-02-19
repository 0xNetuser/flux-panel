'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { updatePassword } from '@/lib/api/auth';
import { logout } from '@/lib/hooks/use-auth';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.currentPassword || !form.newPassword) {
      toast.error('请填写当前密码和新密码');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    if (form.newPassword.length < 6) {
      toast.error('新密码长度不能少于6位');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      };
      if (form.newUsername) {
        data.newUsername = form.newUsername;
      }

      const res = await updatePassword(data);
      if (res.code === 0) {
        toast.success('密码修改成功，请重新登录');
        setTimeout(() => {
          logout();
        }, 1000);
      } else {
        toast.error(res.msg || '修改失败');
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
          <div className="flex justify-center mb-2">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">修改密码</CardTitle>
          <CardDescription>修改完成后需要重新登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newUsername">新用户名 (可选)</Label>
              <Input
                id="newUsername"
                value={form.newUsername}
                onChange={e => setForm(p => ({ ...p, newUsername: e.target.value }))}
                placeholder="留空则不修改用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input
                id="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
                placeholder="请输入当前密码"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={form.newPassword}
                onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="请输入新密码"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="再次输入新密码"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />返回
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? '提交中...' : '确认修改'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
