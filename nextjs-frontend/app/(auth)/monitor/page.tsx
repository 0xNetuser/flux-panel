'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Server, Cpu, HardDrive, Network, RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getNodeHealth, getLatencyHistory, getTrafficOverview } from '@/lib/api/monitor';
import { post } from '@/lib/api/client';
import { useTranslation } from '@/lib/i18n';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const LATENCY_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#a4de6c', '#d0ed57', '#8dd1e1', '#83a6ed'];

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
  interfaces?: { name: string; ips: string[] }[];
  bytesReceived?: number;
  bytesTransmitted?: number;
}

function formatSpeed(bytesPerSec: number) {
  if (bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(Math.abs(bytesPerSec)) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
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
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [forwards, setForwards] = useState<ForwardItem[]>([]);
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [granularity, setGranularity] = useState('hour');
  const [latencyRange, setLatencyRange] = useState('6');
  const [selectedForwards, setSelectedForwards] = useState<Set<number>>(new Set());
  const [latencyChartData, setLatencyChartData] = useState<any[]>([]);
  const [latencyStatsData, setLatencyStatsData] = useState<Record<number, { avg: number; last: number; successRate: number }>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoad = useRef(true);
  const filterRef = useRef<HTMLDivElement>(null);
  const forwardsInitialized = useRef(false);

  // Real-time speed tracking
  const [nodeSpeeds, setNodeSpeeds] = useState<Record<number, { uploadSpeed: number; downloadSpeed: number }>>({});
  const prevBytesRef = useRef<Record<number, { rx: number; tx: number; time: number }>>({});

  // WebSocket for real-time system info updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsBase = process.env.NEXT_PUBLIC_API_BASE || window.location.origin;
    const wsUrl = wsBase.replace(/^http/, 'ws') + '/system-info?type=0';

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl, [token]);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'info' && msg.data) {
            const sysData = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
            const nodeId = parseInt(msg.id, 10);

            if (sysData.bytes_received !== undefined && sysData.bytes_transmitted !== undefined) {
              const now = Date.now() / 1000;
              const rx = sysData.bytes_received;
              const tx = sysData.bytes_transmitted;

              const prev = prevBytesRef.current[nodeId];
              if (prev) {
                const dt = now - prev.time;
                if (dt > 0) {
                  if (rx >= prev.rx && tx >= prev.tx) {
                    // Normal increment — compute speed
                    setNodeSpeeds(s => ({
                      ...s,
                      [nodeId]: {
                        downloadSpeed: (rx - prev.rx) / dt,
                        uploadSpeed: (tx - prev.tx) / dt,
                      }
                    }));
                  } else {
                    // Counter reset (node restarted) — reset speed to 0
                    setNodeSpeeds(s => ({
                      ...s,
                      [nodeId]: { downloadSpeed: 0, uploadSpeed: 0 }
                    }));
                  }
                }
              }
              prevBytesRef.current[nodeId] = { rx, tx, time: now };

              // Also update node bytes for total display
              setNodes(prev => prev.map(n =>
                n.id === nodeId
                  ? { ...n, bytesReceived: rx, bytesTransmitted: tx, cpuUsage: sysData.cpu_usage, memUsage: sysData.memory_usage, uptime: sysData.uptime }
                  : n
              ));
            }
          }
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

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
      if (!forwardsInitialized.current) {
        const activeIds = new Set<number>(fwds.filter((f: ForwardItem) => f.status === 1).map((f: ForwardItem) => f.id));
        setSelectedForwards(activeIds);
        forwardsInitialized.current = true;
      }
    }

    setLoading(false);
    setRefreshing(false);
    initialLoad.current = false;
  }, [granularity]);

  const loadLatencyChartData = useCallback(async () => {
    const activeForwards = forwards.filter((f) => f.status === 1 && selectedForwards.has(f.id));
    if (activeForwards.length === 0) {
      setLatencyChartData([]);
      setLatencyStatsData({});
      return;
    }

    const hours = parseInt(latencyRange);
    const allData: Record<number, LatencyRecord[]> = {};
    await Promise.all(
      activeForwards.map(async (f) => {
        const res = await getLatencyHistory(f.id, hours);
        if (res.code === 0 && res.data) {
          allData[f.id] = res.data as LatencyRecord[];
        }
      })
    );

    // Compute stats
    const stats: Record<number, { avg: number; last: number; successRate: number }> = {};
    for (const f of activeForwards) {
      const records = allData[f.id] || [];
      if (records.length === 0) continue;
      const successes = records.filter((r) => r.success);
      const avg = successes.length > 0
        ? successes.reduce((sum, r) => sum + r.latency, 0) / successes.length
        : -1;
      const last = records[records.length - 1];
      stats[f.id] = {
        avg: Math.round(avg * 100) / 100,
        last: last.success ? Math.round(last.latency * 100) / 100 : -1,
        successRate: records.length > 0 ? Math.round((successes.length / records.length) * 100) : 0,
      };
    }
    setLatencyStatsData(stats);

    // Merge data by recordTime
    const timeMap = new Map<number, Record<string, any>>();
    for (const f of activeForwards) {
      const records = allData[f.id] || [];
      for (const r of records) {
        if (!timeMap.has(r.recordTime)) {
          timeMap.set(r.recordTime, { time: formatTime(r.recordTime), _ts: r.recordTime });
        }
        const row = timeMap.get(r.recordTime)!;
        row[f.name] = r.success ? r.latency : null;
      }
    }

    const merged = Array.from(timeMap.values()).sort((a, b) => a._ts - b._ts);
    setLatencyChartData(merged);
  }, [forwards, selectedForwards, latencyRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => { loadData(); }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Load latency chart data when selection or range changes
  useEffect(() => {
    if (forwards.length > 0) {
      loadLatencyChartData();
    }
  }, [loadLatencyChartData]);

  // Click outside to close filter panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        <h2 className="text-2xl font-bold">{t('monitor.title')}</h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          {t('monitor.refresh')}
        </Button>
      </div>

      {/* Node Health Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3">{t('monitor.nodeStatus')}</h3>
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
                    {node.online ? t('common.online') : t('common.offline')}
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
                      <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{t('monitor.memory')}</span>
                      <span>{node.memUsage?.toFixed(1)}%</span>
                    </div>
                    {node.uptime !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>{t('monitor.uptime')}</span>
                        <span>{formatUptime(node.uptime)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>GOST</span>
                      <Badge variant="default" className="text-xs">{t('monitor.running')}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Xray</span>
                      {node.xrayRunning ? (
                        <Badge variant="default" className="text-xs">
                          {node.xrayVersion?.match(/Xray\s+([\d.]+)/)?.[1] ? `Xray ${node.xrayVersion.match(/Xray\s+([\d.]+)/)![1]}` : (node.xrayVersion || t('monitor.running'))}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{t('monitor.notRunning')}</Badge>
                      )}
                    </div>
                    {/* Real-time speed */}
                    {(nodeSpeeds[node.id] || node.bytesReceived !== undefined) && (
                      <div className="pt-1 border-t space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Network className="h-3 w-3" />{t('monitor.realTimeSpeed')}
                          </span>
                        </div>
                        {nodeSpeeds[node.id] && (
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-green-500">{t('monitor.upload')}</span>
                              <span>{formatSpeed(nodeSpeeds[node.id].uploadSpeed)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-blue-500">{t('monitor.download')}</span>
                              <span>{formatSpeed(nodeSpeeds[node.id].downloadSpeed)}</span>
                            </div>
                          </div>
                        )}
                        {node.bytesTransmitted !== undefined && node.bytesReceived !== undefined && (
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span>{t('monitor.totalUpload')}</span>
                              <span>{formatBytes(node.bytesTransmitted)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>{t('monitor.totalDownload')}</span>
                              <span>{formatBytes(node.bytesReceived)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {node.interfaces && node.interfaces.length > 0 && (
                      <div className="pt-1 border-t">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <Network className="h-3 w-3" />
                          <span className="text-xs">{t('monitor.nic')}</span>
                        </div>
                        <div className="space-y-0.5">
                          {node.interfaces.map((iface) => (
                            <div key={iface.name} className="text-xs font-mono">
                              <span className="text-foreground">{iface.name}</span>
                              <span className="text-muted-foreground ml-1">{iface.ips.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {node.version && (
                  <div className="text-xs text-muted-foreground">v{node.version}</div>
                )}
              </CardContent>
            </Card>
          ))}
          {nodes.length === 0 && !loading && (
            <p className="text-muted-foreground col-span-full text-center py-8">{t('monitor.noNodes')}</p>
          )}
        </div>
      </div>

      {/* Global Traffic Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('monitor.globalTrafficStats')}</CardTitle>
            <Select value={granularity} onValueChange={(v) => setGranularity(v)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">{t('monitor.hour')}</SelectItem>
                <SelectItem value="day">{t('monitor.day')}</SelectItem>
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
                <Area type="monotone" dataKey="inFlow" name={t('monitor.inbound')} stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                <Area type="monotone" dataKey="outFlow" name={t('monitor.outbound')} stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">{t('monitor.noTrafficData')}</div>
          )}
        </CardContent>
      </Card>

      {/* Forward Latency Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('monitor.forwardLatency')}</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={latencyRange} onValueChange={(v) => setLatencyRange(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('monitor.hours1')}</SelectItem>
                  <SelectItem value="6">{t('monitor.hours6')}</SelectItem>
                  <SelectItem value="24">{t('monitor.hours24')}</SelectItem>
                  <SelectItem value="168">{t('monitor.days7')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative" ref={filterRef}>
                <Button variant="outline" size="sm" onClick={() => setFilterOpen(!filterOpen)}>
                  <Filter className="h-4 w-4 mr-1" />
                  {selectedForwards.size === forwards.filter(f => f.status === 1).length
                    ? t('monitor.allForwards')
                    : t('monitor.selected', { count: selectedForwards.size })}
                </Button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md p-3 min-w-[200px]">
                    {forwards.filter(f => f.status === 1).map((f) => (
                      <label key={f.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <Checkbox
                          checked={selectedForwards.has(f.id)}
                          onCheckedChange={(checked) => {
                            setSelectedForwards((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(f.id);
                              else next.delete(f.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm">{f.name}</span>
                      </label>
                    ))}
                    {forwards.filter(f => f.status === 1).length === 0 && (
                      <p className="text-sm text-muted-foreground">{t('monitor.noRunningForwards')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {forwards.filter(f => f.status === 1).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t('monitor.noRunningForwards')}</div>
          ) : selectedForwards.size === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t('monitor.selectAtLeast')}</div>
          ) : latencyChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={latencyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={11} />
                  <YAxis fontSize={11} unit="ms" />
                  <Tooltip formatter={(v: any) => (v != null ? `${v}ms` : '失败')} />
                  <Legend />
                  {forwards
                    .filter((f) => f.status === 1 && selectedForwards.has(f.id))
                    .map((f, i) => (
                      <Line
                        key={f.id}
                        type="monotone"
                        dataKey={f.name}
                        stroke={LATENCY_COLORS[i % LATENCY_COLORS.length]}
                        dot={false}
                        connectNulls={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Statistics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
                {forwards
                  .filter((f) => f.status === 1 && selectedForwards.has(f.id))
                  .map((f) => {
                    const stat = latencyStatsData[f.id];
                    return (
                      <div key={f.id} className="border rounded-md p-3 space-y-1">
                        <div className="font-medium text-sm truncate">{f.name}</div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('monitor.latestLatency')}</span>
                          <span>{stat ? (stat.last >= 0 ? `${stat.last}ms` : t('monitor.timeout')) : '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('monitor.avgLatency')}</span>
                          <span>{stat ? (stat.avg >= 0 ? `${stat.avg}ms` : '-') : '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t('monitor.successRate')}</span>
                          {stat ? (
                            <Badge variant={stat.successRate >= 80 ? 'default' : 'destructive'} className="text-xs">
                              {stat.successRate}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">{t('monitor.noLatencyData')}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
