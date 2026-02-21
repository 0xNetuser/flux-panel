'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Server, Users, Activity, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getDashboardStats, checkUpdate, selfUpdate, UpdateInfo } from '@/lib/api/system';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const res = await getDashboardStats();
    if (res.code === 0) setStats(res.data);
    setLoading(false);

    if (isAdmin) {
      const updateRes = await checkUpdate();
      if (updateRes.code === 0 && updateRes.data?.hasUpdate) {
        setUpdateInfo(updateRes.data);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">仪表板</h2>
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">仪表板</h2>
        <p className="text-muted-foreground">加载数据失败</p>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard stats={stats} updateInfo={updateInfo} />;
  }
  return <UserDashboard stats={stats} />;
}

function AdminDashboard({ stats, updateInfo }: { stats: any; updateInfo: UpdateInfo | null }) {
  const [updating, setUpdating] = useState(false);

  const handleSelfUpdate = async () => {
    if (!confirm('确定要更新面板吗？面板将在几秒后自动重启。')) return;
    setUpdating(true);
    const res = await selfUpdate();
    if (res.code === 0) {
      alert('更新已启动，面板将在几秒后自动重启');
    } else {
      alert(res.msg || '更新失败');
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">仪表板</h2>

      {/* Update Banner */}
      {updateInfo && (
        <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                新版本 {updateInfo.latest} 可用（当前 {updateInfo.current}）
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                更新命令：<code className="bg-muted px-1 rounded">docker compose pull && docker compose up -d</code>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelfUpdate}
                disabled={updating}
                className="text-orange-600 border-orange-500/50 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950/40"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${updating ? 'animate-spin' : ''}`} />
                {updating ? '更新中...' : '一键更新'}
              </Button>
              <a
                href={updateInfo.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1"
              >
                Release <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">节点</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.nodes?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">{stats.nodes?.online || 0} 在线</Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">转发</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.forwards?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">{stats.forwards?.active || 0} 活跃</Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日流量</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.todayTraffic || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">流量趋势（24h）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trafficHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip
                  formatter={(value) => [formatBytes(Number(value || 0)), '流量']}
                  labelFormatter={(label) => `时间: ${label}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="flow"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Node Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">节点概览</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.nodeList || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">暂无节点</TableCell>
                  </TableRow>
                ) : (
                  (stats.nodeList || []).map((node: any) => (
                    <TableRow key={node.id}>
                      <TableCell className="font-medium">{node.name}</TableCell>
                      <TableCell className="text-sm">{node.serverIp}</TableCell>
                      <TableCell>
                        <Badge variant={node.status === 1 ? 'default' : 'destructive'}>
                          {node.status === 1 ? '在线' : '离线'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{node.version || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Users by Traffic */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">用户流量排行（Top 5）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排名</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>流量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.topUsers || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">暂无数据</TableCell>
                  </TableRow>
                ) : (
                  (stats.topUsers || []).map((user: any, idx: number) => (
                    <TableRow key={user.name}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{formatBytes(user.flow || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserDashboard({ stats }: { stats: any }) {
  const pkg = stats.package || {};

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">仪表板</h2>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">转发数量</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.forwards || 0}</div>
            <p className="text-xs text-muted-foreground">限额 {pkg.num || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">已用流量</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes((pkg.inFlow || 0) + (pkg.outFlow || 0))}</div>
            <p className="text-xs text-muted-foreground">总额 {pkg.flow || 0} GB</p>
          </CardContent>
        </Card>
        {pkg.expTime && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">到期时间</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{new Date(pkg.expTime).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Traffic Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">流量趋势（24h）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trafficHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip
                  formatter={(value) => [formatBytes(Number(value || 0)), '流量']}
                  labelFormatter={(label) => `时间: ${label}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="flow"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
