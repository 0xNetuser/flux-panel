'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Server, Users, Activity } from 'lucide-react';
import { getNodeList } from '@/lib/api/node';
import { getForwardList } from '@/lib/api/forward';
import { getAllUsers } from '@/lib/api/user';
import { useAuth } from '@/lib/hooks/use-auth';
import { getUserPackageInfo } from '@/lib/api/user';

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState({ nodes: 0, onlineNodes: 0, forwards: 0, users: 0 });
  const [userPackage, setUserPackage] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [nodeRes, forwardRes] = await Promise.all([
      getNodeList(),
      getForwardList(),
    ]);

    let nodes = 0, onlineNodes = 0, forwards = 0, users = 0;

    if (nodeRes.code === 0 && Array.isArray(nodeRes.data)) {
      nodes = nodeRes.data.length;
      onlineNodes = nodeRes.data.filter((n: any) => n.status === 1).length;
    }

    if (forwardRes.code === 0 && Array.isArray(forwardRes.data)) {
      forwards = forwardRes.data.length;
    }

    if (isAdmin) {
      const userRes = await getAllUsers();
      if (userRes.code === 0 && Array.isArray(userRes.data)) {
        users = userRes.data.length;
      }
    } else {
      const pkgRes = await getUserPackageInfo();
      if (pkgRes.code === 0) {
        setUserPackage(pkgRes.data);
      }
    }

    setStats({ nodes, onlineNodes, forwards, users });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">仪表板</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">节点</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.nodes}</div>
                <p className="text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">{stats.onlineNodes} 在线</Badge>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">用户</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.users}</div>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">转发</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.forwards}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">状态</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">运行中</div>
          </CardContent>
        </Card>
      </div>

      {!isAdmin && userPackage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">我的套餐</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">已用流量: {formatBytes((userPackage.inFlow || 0) + (userPackage.outFlow || 0))} / {userPackage.flow} GB</p>
            <p className="text-sm">转发数量: {stats.forwards} / {userPackage.num}</p>
            {userPackage.expTime && (
              <p className="text-sm">到期时间: {new Date(userPackage.expTime).toLocaleDateString()}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
