'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Database, Clock, ArrowRightLeft, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getUserPackageInfo } from '@/lib/api/user';
import { useAuth } from '@/lib/hooks/use-auth';

export default function ProfilePage() {
  const { username, isAdmin } = useAuth();
  const router = useRouter();
  const [packageInfo, setPackageInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getUserPackageInfo();
    if (res.code === 0) {
      setPackageInfo(res.data);
    } else {
      toast.error(res.msg || '加载用户信息失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const usedFlow = packageInfo ? (packageInfo.inFlow || 0) + (packageInfo.outFlow || 0) : 0;
  const totalFlow = packageInfo?.flow ? packageInfo.flow * 1024 * 1024 * 1024 : 0;
  const flowPercent = totalFlow > 0 ? Math.min((usedFlow / totalFlow) * 100, 100) : 0;
  const isExpired = packageInfo?.expTime && new Date(packageInfo.expTime) < new Date();
  const isOverFlow = totalFlow > 0 && usedFlow >= totalFlow;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">个人中心</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* User Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">用户信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">用户名</span>
              <span className="font-medium">{username}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">角色</span>
              <Badge variant={isAdmin ? 'default' : 'secondary'}>
                {isAdmin ? '管理员' : '用户'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">账号状态</span>
              {isExpired ? (
                <Badge variant="destructive">已过期</Badge>
              ) : isOverFlow ? (
                <Badge variant="destructive">流量超限</Badge>
              ) : (
                <Badge variant="default">正常</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Flow Usage Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">流量使用</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">已用流量</span>
              <span className="font-medium">{formatBytes(usedFlow)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">总流量</span>
              <span className="font-medium">{packageInfo?.flow ? `${packageInfo.flow} GB` : '无限'}</span>
            </div>
            {totalFlow > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>使用进度</span>
                  <span>{flowPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${flowPercent > 90 ? 'bg-destructive' : flowPercent > 70 ? 'bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${flowPercent}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">上传</span>
              <span>{formatBytes(packageInfo?.inFlow || 0)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">下载</span>
              <span>{formatBytes(packageInfo?.outFlow || 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Package Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">套餐信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">转发数量限制</span>
              <span className="font-medium">{packageInfo?.num || '无限'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">到期时间</span>
              <span className="font-medium">
                {packageInfo?.expTime ? new Date(packageInfo.expTime).toLocaleString() : '永不过期'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/change-password')}>
              <KeyRound className="mr-2 h-4 w-4" />
              修改密码
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
