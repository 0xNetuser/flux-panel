'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server, Cpu, HardDrive, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getNodeHealth, getLatencyHistory, getTrafficOverview } from '@/lib/api/monitor';
import { post } from '@/lib/api/client';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface NodeHealth {
  id: number;
  name: string;
  serverIp: string;
  online: boolean;
  version: string;
  cpuUsage?: number;
  memUsage?: number;
  uptime?: number;
  xrayRunning?: boolean;
  xrayVersion?: string;
}

interface ForwardItem {
  id: number;
  name: string;
  remoteAddr: string;
  status: number;
  tunnelName?: string;
}

interface LatencyRecord {
  id: number;
  forwardId: number;
  targetAddr: string;
  latency: number;
  success: boolean;
  recordTime: number;
}

export default function MonitorPage() {
  const { isAdmin } = useAuth();
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [forwards, setForwards] = useState<ForwardItem[]>([]);
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [granularity, setGranularity] = useState('hour');
  const [expandedForward, setExpandedForward] = useState<number | null>(null);
  const [latencyData, setLatencyData] = useState<LatencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latencyStats, setLatencyStats] = useState<Record<number, { avg: number; last: number; successRate: number }>>({});
  const initialLoad = useRef(true);

  const loadData = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    setRefreshing(true);

    const [healthRes, trafficRes, forwardRes] = await Promise.all([
      getNodeHealth(),
      getTrafficOverview(granularity, granularity === 'day' ? 168 : 24),
      post('/forward/list', {}),
    ]);

    if (healthRes.code === 0) setNodes(healthRes.data || []);
    if (trafficRes.code === 0) {
      setTrafficData((trafficRes.data || []).map((d: any) => ({
        ...d,
        time: formatTime(d.time),
      })));
    }
    if (forwardRes.code === 0) {
      const fwds = forwardRes.data || [];
      setForwards(fwds);
      // Load latest latency stats for active forwards
      await loadLatencyStats(fwds.filter((f: ForwardItem) => f.status === 1));
    }

    setLoading(false);
    setRefreshing(false);
    initialLoad.current = false;
  }, [granularity]);

  const loadLatencyStats = async (activeForwards: ForwardItem[]) => {
    const stats: Record<number, { avg: number; last: number; successRate: number }> = {};
    await Promise.all(
      activeForwards.map(async (f) => {
        const res = await getLatencyHistory(f.id, 1);
        if (res.code === 0 && res.data && res.data.length > 0) {
          const records = res.data as LatencyRecord[];
          const successes = records.filter((r) => r.success);
          const avg = successes.length > 0
            ? successes.reduce((sum, r) => sum + r.latency, 0) / successes.length
            : -1;
          const last = records[records.length - 1];
          stats[f.id] = {
            avg: Math.round(avg * 100) / 100,
            last: last.success ? Math.round(last.latency * 100) / 100 : -1,
            successRate: Math.round((successes.length / records.length) * 100),
          };
        }
      })
    );
    setLatencyStats(stats);
  };

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  const toggleExpand = async (forwardId: number) => {
    if (expandedForward === forwardId) {
      setExpandedForward(null);
      return;
    }
    setExpandedForward(forwardId);
    const res = await getLatencyHistory(forwardId, 6);
    if (res.code === 0) {
      setLatencyData((res.data || []).map((r: LatencyRecord) => ({
        ...r,
        time: formatTime(r.recordTime),
        latency: r.success ? r.latency : null,
      })));
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">监控</h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Node Health Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3">节点状态</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {nodes.map((node) => (
            <Card key={node.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {node.name}
                  </CardTitle>
                  <Badge variant={node.online ? 'default' : 'secondary'}>
                    {node.online ? '在线' : '离线'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">{node.serverIp}</div>
                {node.online && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />CPU</span>
                      <span>{node.cpuUsage?.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />内存</span>
                      <span>{node.memUsage?.toFixed(1)}%</span>
                    </div>
                    {node.uptime !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>运行时间</span>
                        <span>{formatUptime(node.uptime)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>GOST</span>
                      <Badge variant="default" className="text-xs">运行中</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Xray</span>
                      {node.xrayRunning ? (
                        <Badge variant="default" className="text-xs">
                          {node.xrayVersion || '运行中'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">未运行</Badge>
                      )}
                    </div>
                  </>
                )}
                {node.version && (
                  <div className="text-xs text-muted-foreground">v{node.version}</div>
                )}
              </CardContent>
            </Card>
          ))}
          {nodes.length === 0 && !loading && (
            <p className="text-muted-foreground col-span-full text-center py-8">暂无节点</p>
          )}
        </div>
      </div>

      {/* Global Traffic Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">全局流量统计</CardTitle>
            <Select value={granularity} onValueChange={(v) => setGranularity(v)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">小时</SelectItem>
                <SelectItem value="day">天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {trafficData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip formatter={(v) => formatBytes(Number(v))} />
                <Area type="monotone" dataKey="inFlow" name="入站" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                <Area type="monotone" dataKey="outFlow" name="出站" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">暂无流量数据</div>
          )}
        </CardContent>
      </Card>

      {/* Forward Latency Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">转发延迟</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>名称</TableHead>
                <TableHead>目标地址</TableHead>
                <TableHead className="text-right">最近延迟</TableHead>
                <TableHead className="text-right">平均延迟</TableHead>
                <TableHead className="text-right">成功率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forwards.filter(f => f.status === 1).map((f) => {
                const stat = latencyStats[f.id];
                const isExpanded = expandedForward === f.id;
                return (
                  <Fragment key={f.id}>
                    <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => toggleExpand(f.id)}>
                      <TableCell>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="font-mono text-xs">{f.remoteAddr}</TableCell>
                      <TableCell className="text-right">
                        {stat ? (stat.last >= 0 ? `${stat.last}ms` : '超时') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat ? (stat.avg >= 0 ? `${stat.avg}ms` : '-') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat ? (
                          <Badge variant={stat.successRate >= 80 ? 'default' : 'destructive'}>
                            {stat.successRate}%
                          </Badge>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-4">
                          {latencyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={latencyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" fontSize={11} />
                                <YAxis fontSize={11} unit="ms" />
                                <Tooltip formatter={(v) => `${v}ms`} />
                                <Line type="monotone" dataKey="latency" name="延迟" stroke="#8884d8" dot={false} connectNulls />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-center text-muted-foreground py-4">暂无延迟数据</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {forwards.filter(f => f.status === 1).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无运行中的转发
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
