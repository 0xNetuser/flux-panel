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
import { useTranslation } from '@/lib/i18n';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
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
        <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
        <p className="text-muted-foreground">{t('dashboard.loadFailed')}</p>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard stats={stats} updateInfo={updateInfo} />;
  }
  return <UserDashboard stats={stats} />;
}

function AdminDashboard({ stats, updateInfo }: { stats: any; updateInfo: UpdateInfo | null }) {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);

  const handleSelfUpdate = async () => {
    if (!confirm(t('dashboard.confirmUpdate'))) return;
    setUpdating(true);
    const res = await selfUpdate();
    if (res.code === 0) {
      alert(t('dashboard.updateStarted'));
    } else {
      alert(res.msg || t('dashboard.updateFailed'));
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>

      {/* Update Banner */}
      {updateInfo && (
        <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {t('dashboard.newVersion', { latest: updateInfo.latest, current: updateInfo.current })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('dashboard.updateCommand')}<code className="bg-muted px-1 rounded">docker compose pull && docker compose up -d</code>
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
                {updating ? t('dashboard.updating') : t('dashboard.oneClickUpdate')}
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
            <CardTitle className="text-sm font-medium">{t('dashboard.nodes')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.nodes?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">{t('dashboard.online', { count: stats.nodes?.online || 0 })}</Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.users')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.forwards')}</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.forwards?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">{t('dashboard.active', { count: stats.forwards?.active || 0 })}</Badge>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.todayTraffic')}</CardTitle>
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
          <CardTitle className="text-sm font-medium">{t('dashboard.trafficTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trafficHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip
                  formatter={(value) => [formatBytes(Number(value || 0)), t('dashboard.traffic')]}
                  labelFormatter={(label) => t('dashboard.time', { time: label })}
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
            <CardTitle className="text-sm font-medium">{t('dashboard.nodeOverview')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.nodeName')}</TableHead>
                  <TableHead>{t('dashboard.ip')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('dashboard.version')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.nodeList || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">{t('dashboard.noNodes')}</TableCell>
                  </TableRow>
                ) : (
                  (stats.nodeList || []).map((node: any) => (
                    <TableRow key={node.id}>
                      <TableCell className="font-medium">{node.name}</TableCell>
                      <TableCell className="text-sm">{node.serverIp}</TableCell>
                      <TableCell>
                        <Badge variant={node.status === 1 ? 'default' : 'destructive'}>
                          {node.status === 1 ? t('common.online') : t('common.offline')}
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
            <CardTitle className="text-sm font-medium">{t('dashboard.userTrafficRank')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.rank')}</TableHead>
                  <TableHead>{t('dashboard.user')}</TableHead>
                  <TableHead>{t('dashboard.flow')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.topUsers || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">{t('common.noData')}</TableCell>
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
  const { t } = useTranslation();
  const pkg = stats.package || {};

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.forwardCount')}</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.forwards || 0}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.quota', { num: pkg.num || 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.usedTraffic')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes((pkg.inFlow || 0) + (pkg.outFlow || 0))}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.totalFlow', { flow: pkg.flow || 0 })}</p>
          </CardContent>
        </Card>
        {pkg.expTime && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.expireTime')}</CardTitle>
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
          <CardTitle className="text-sm font-medium">{t('dashboard.trafficTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trafficHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip
                  formatter={(value) => [formatBytes(Number(value || 0)), t('dashboard.traffic')]}
                  labelFormatter={(label) => t('dashboard.time', { time: label })}
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
