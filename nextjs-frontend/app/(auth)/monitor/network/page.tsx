'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getLatencyHistory, getTrafficOverview, getForwardFlowHistory, getXrayTrafficOverview, getXrayInboundFlowHistory } from '@/lib/api/monitor';
import { post } from '@/lib/api/client';
import { useTranslation } from '@/lib/i18n';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#a4de6c', '#d0ed57', '#8dd1e1', '#83a6ed'];

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface ForwardItem {
  id: number;
  name: string;
  remoteAddr: string;
  status: number;
  tunnelName?: string;
}

interface InboundItem {
  id: number;
  remark: string;
  protocol: string;
  port: number;
  enable: number;
}

interface LatencyRecord {
  id: number;
  forwardId: number;
  targetAddr: string;
  latency: number;
  success: boolean;
  recordTime: number;
}

export default function NetworkMonitorPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [forwards, setForwards] = useState<ForwardItem[]>([]);
  const [inbounds, setInbounds] = useState<InboundItem[]>([]);

  // GOST traffic state
  const [gostTrafficData, setGostTrafficData] = useState<any[]>([]);
  const [gostGranularity, setGostGranularity] = useState('hour');
  const [gostMode, setGostMode] = useState<'total' | 'byForward'>('total');
  const [gostSelectedForwards, setGostSelectedForwards] = useState<Set<number>>(new Set());
  const [gostForwardChartData, setGostForwardChartData] = useState<any[]>([]);
  const [gostFilterOpen, setGostFilterOpen] = useState(false);
  const gostFilterRef = useRef<HTMLDivElement>(null);
  const [gostHidden, setGostHidden] = useState<Set<string>>(new Set());

  // Xray traffic state
  const [xrayTrafficData, setXrayTrafficData] = useState<any[]>([]);
  const [xrayGranularity, setXrayGranularity] = useState('hour');
  const [xrayMode, setXrayMode] = useState<'total' | 'byInbound'>('total');
  const [xraySelectedInbounds, setXraySelectedInbounds] = useState<Set<number>>(new Set());
  const [xrayInboundChartData, setXrayInboundChartData] = useState<any[]>([]);
  const [xrayFilterOpen, setXrayFilterOpen] = useState(false);
  const xrayFilterRef = useRef<HTMLDivElement>(null);
  const [xrayHidden, setXrayHidden] = useState<Set<string>>(new Set());

  // Latency state
  const [latencyRange, setLatencyRange] = useState('6');
  const [selectedForwards, setSelectedForwards] = useState<Set<number>>(new Set());
  const [latencyChartData, setLatencyChartData] = useState<any[]>([]);
  const [latencyStatsData, setLatencyStatsData] = useState<Record<number, { avg: number; last: number; successRate: number }>>({});
  const [latencyFilterOpen, setLatencyFilterOpen] = useState(false);
  const latencyFilterRef = useRef<HTMLDivElement>(null);
  const [latencyHidden, setLatencyHidden] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoad = useRef(true);
  const forwardsInitialized = useRef(false);
  const inboundsInitialized = useRef(false);

  const loadData = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    setRefreshing(true);

    const [gostTrafficRes, xrayTrafficRes, forwardRes, inboundRes] = await Promise.all([
      getTrafficOverview(gostGranularity, gostGranularity === 'day' ? 168 : 24),
      getXrayTrafficOverview(xrayGranularity, xrayGranularity === 'day' ? 168 : 24),
      post('/forward/list', {}),
      post('/v/inbound/list', {}),
    ]);

    if (gostTrafficRes.code === 0) {
      setGostTrafficData((gostTrafficRes.data || []).map((d: any) => ({
        ...d,
        time: formatTime(d.time),
      })));
    }
    if (xrayTrafficRes.code === 0) {
      setXrayTrafficData((xrayTrafficRes.data || []).map((d: any) => ({
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
        setGostSelectedForwards(activeIds);
        forwardsInitialized.current = true;
      }
    }
    if (inboundRes.code === 0) {
      const ibs = inboundRes.data || [];
      setInbounds(ibs);
      if (!inboundsInitialized.current) {
        const enabledIds = new Set<number>(ibs.filter((ib: InboundItem) => ib.enable === 1).map((ib: InboundItem) => ib.id));
        setXraySelectedInbounds(enabledIds);
        inboundsInitialized.current = true;
      }
    }

    setLoading(false);
    setRefreshing(false);
    initialLoad.current = false;
  }, [gostGranularity, xrayGranularity]);

  // Load per-forward flow data when in byForward mode
  const loadGostForwardData = useCallback(async () => {
    if (gostMode !== 'byForward' || gostSelectedForwards.size === 0) {
      setGostForwardChartData([]);
      return;
    }
    const selected = forwards.filter(f => gostSelectedForwards.has(f.id));
    const hours = gostGranularity === 'day' ? 168 : 24;
    const allData: Record<number, any[]> = {};
    await Promise.all(
      selected.map(async (f) => {
        const res = await getForwardFlowHistory(f.id, hours);
        if (res.code === 0 && res.data) allData[f.id] = res.data;
      })
    );

    const timeMap = new Map<number, Record<string, any>>();
    for (const f of selected) {
      for (const r of (allData[f.id] || [])) {
        if (!timeMap.has(r.recordTime)) {
          timeMap.set(r.recordTime, { time: formatTime(r.recordTime), _ts: r.recordTime });
        }
        const row = timeMap.get(r.recordTime)!;
        row[f.name] = (r.inFlow || 0) + (r.outFlow || 0);
      }
    }
    const merged = Array.from(timeMap.values()).sort((a, b) => a._ts - b._ts);
    setGostForwardChartData(merged);
  }, [gostMode, gostSelectedForwards, forwards, gostGranularity]);

  // Load per-inbound flow data when in byInbound mode
  const loadXrayInboundData = useCallback(async () => {
    if (xrayMode !== 'byInbound' || xraySelectedInbounds.size === 0) {
      setXrayInboundChartData([]);
      return;
    }
    const selected = inbounds.filter(ib => xraySelectedInbounds.has(ib.id));
    const hours = xrayGranularity === 'day' ? 168 : 24;
    const allData: Record<number, any[]> = {};
    await Promise.all(
      selected.map(async (ib) => {
        const res = await getXrayInboundFlowHistory(ib.id, hours);
        if (res.code === 0 && res.data) allData[ib.id] = res.data;
      })
    );

    const timeMap = new Map<number, Record<string, any>>();
    for (const ib of selected) {
      const label = ib.remark || `#${ib.id}`;
      for (const r of (allData[ib.id] || [])) {
        if (!timeMap.has(r.recordTime)) {
          timeMap.set(r.recordTime, { time: formatTime(r.recordTime), _ts: r.recordTime });
        }
        const row = timeMap.get(r.recordTime)!;
        row[label] = (r.inFlow || 0) + (r.outFlow || 0);
      }
    }
    const merged = Array.from(timeMap.values()).sort((a, b) => a._ts - b._ts);
    setXrayInboundChartData(merged);
  }, [xrayMode, xraySelectedInbounds, inbounds, xrayGranularity]);

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

  // Load per-forward data when mode/selection changes
  useEffect(() => {
    if (forwards.length > 0) loadGostForwardData();
  }, [loadGostForwardData]);

  // Load per-inbound data when mode/selection changes
  useEffect(() => {
    if (inbounds.length > 0) loadXrayInboundData();
  }, [loadXrayInboundData]);

  // Click outside to close filter panels
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gostFilterRef.current && !gostFilterRef.current.contains(e.target as Node)) {
        setGostFilterOpen(false);
      }
      if (xrayFilterRef.current && !xrayFilterRef.current.contains(e.target as Node)) {
        setXrayFilterOpen(false);
      }
      if (latencyFilterRef.current && !latencyFilterRef.current.contains(e.target as Node)) {
        setLatencyFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLegendClick = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (e: any) => {
    const key = e.dataKey || e.value;
    setter(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('common.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('monitor.networkMonitorTitle')}</h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          {t('monitor.refresh')}
        </Button>
      </div>

      {/* GOST Traffic Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">{t('monitor.gostTrafficStats')}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border overflow-hidden">
                <button
                  className={`px-3 py-1 text-xs ${gostMode === 'total' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  onClick={() => setGostMode('total')}
                >
                  {t('monitor.totalTraffic')}
                </button>
                <button
                  className={`px-3 py-1 text-xs ${gostMode === 'byForward' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  onClick={() => setGostMode('byForward')}
                >
                  {t('monitor.byForward')}
                </button>
              </div>
              <Select value={gostGranularity} onValueChange={(v) => setGostGranularity(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">{t('monitor.hour')}</SelectItem>
                  <SelectItem value="day">{t('monitor.day')}</SelectItem>
                </SelectContent>
              </Select>
              {gostMode === 'byForward' && (
                <div className="relative" ref={gostFilterRef}>
                  <Button variant="outline" size="sm" onClick={() => setGostFilterOpen(!gostFilterOpen)}>
                    <Filter className="h-4 w-4 mr-1" />
                    {gostSelectedForwards.size === forwards.filter(f => f.status === 1).length
                      ? t('monitor.allForwards')
                      : t('monitor.selected', { count: gostSelectedForwards.size })}
                  </Button>
                  {gostFilterOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md p-3 min-w-[200px] max-h-[300px] overflow-y-auto">
                      {forwards.filter(f => f.status === 1).map((f) => (
                        <label key={f.id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <Checkbox
                            checked={gostSelectedForwards.has(f.id)}
                            onCheckedChange={(checked) => {
                              setGostSelectedForwards((prev) => {
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
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {gostMode === 'total' ? (
            gostTrafficData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={gostTrafficData}>
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
            )
          ) : (
            gostForwardChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gostForwardChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => formatBytes(v)} />
                  <Tooltip formatter={(v) => formatBytes(Number(v))} />
                  <Legend
                    onClick={handleLegendClick(setGostHidden)}
                    wrapperStyle={{ fontSize: 12, maxHeight: 60, overflowY: 'auto', cursor: 'pointer' }}
                    formatter={(value) => (
                      <span style={{ color: gostHidden.has(value as string) ? '#ccc' : undefined }}>{value}</span>
                    )}
                  />
                  {forwards
                    .filter(f => gostSelectedForwards.has(f.id))
                    .map((f, i) => (
                      <Line key={f.id} type="monotone" dataKey={f.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} hide={gostHidden.has(f.name)} />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">{t('monitor.noTrafficData')}</div>
            )
          )}
        </CardContent>
      </Card>

      {/* Xray Traffic Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">{t('monitor.xrayTrafficStats')}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border overflow-hidden">
                <button
                  className={`px-3 py-1 text-xs ${xrayMode === 'total' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  onClick={() => setXrayMode('total')}
                >
                  {t('monitor.totalTraffic')}
                </button>
                <button
                  className={`px-3 py-1 text-xs ${xrayMode === 'byInbound' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  onClick={() => setXrayMode('byInbound')}
                >
                  {t('monitor.byInbound')}
                </button>
              </div>
              <Select value={xrayGranularity} onValueChange={(v) => setXrayGranularity(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">{t('monitor.hour')}</SelectItem>
                  <SelectItem value="day">{t('monitor.day')}</SelectItem>
                </SelectContent>
              </Select>
              {xrayMode === 'byInbound' && (
                <div className="relative" ref={xrayFilterRef}>
                  <Button variant="outline" size="sm" onClick={() => setXrayFilterOpen(!xrayFilterOpen)}>
                    <Filter className="h-4 w-4 mr-1" />
                    {xraySelectedInbounds.size === inbounds.length
                      ? t('monitor.allInbounds')
                      : t('monitor.selected', { count: xraySelectedInbounds.size })}
                  </Button>
                  {xrayFilterOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md p-3 min-w-[200px] max-h-[300px] overflow-y-auto">
                      {inbounds.map((ib) => (
                        <label key={ib.id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <Checkbox
                            checked={xraySelectedInbounds.has(ib.id)}
                            onCheckedChange={(checked) => {
                              setXraySelectedInbounds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(ib.id);
                                else next.delete(ib.id);
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm">{ib.remark || `#${ib.id}`} ({ib.protocol}:{ib.port})</span>
                        </label>
                      ))}
                      {inbounds.length === 0 && (
                        <p className="text-sm text-muted-foreground">{t('monitor.noXrayTrafficData')}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {xrayMode === 'total' ? (
            xrayTrafficData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={xrayTrafficData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => formatBytes(v)} />
                  <Tooltip formatter={(v) => formatBytes(Number(v))} />
                  <Area type="monotone" dataKey="inFlow" name={t('monitor.inbound')} stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="outFlow" name={t('monitor.outbound')} stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">{t('monitor.noXrayTrafficData')}</div>
            )
          ) : (
            xrayInboundChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={xrayInboundChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => formatBytes(v)} />
                  <Tooltip formatter={(v) => formatBytes(Number(v))} />
                  <Legend
                    onClick={handleLegendClick(setXrayHidden)}
                    wrapperStyle={{ fontSize: 12, maxHeight: 60, overflowY: 'auto', cursor: 'pointer' }}
                    formatter={(value) => (
                      <span style={{ color: xrayHidden.has(value as string) ? '#ccc' : undefined }}>{value}</span>
                    )}
                  />
                  {inbounds
                    .filter(ib => xraySelectedInbounds.has(ib.id))
                    .map((ib, i) => (
                      <Line key={ib.id} type="monotone" dataKey={ib.remark || `#${ib.id}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} hide={xrayHidden.has(ib.remark || `#${ib.id}`)} />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">{t('monitor.noXrayTrafficData')}</div>
            )
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
              <div className="relative" ref={latencyFilterRef}>
                <Button variant="outline" size="sm" onClick={() => setLatencyFilterOpen(!latencyFilterOpen)}>
                  <Filter className="h-4 w-4 mr-1" />
                  {selectedForwards.size === forwards.filter(f => f.status === 1).length
                    ? t('monitor.allForwards')
                    : t('monitor.selected', { count: selectedForwards.size })}
                </Button>
                {latencyFilterOpen && (
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
                  <Tooltip formatter={(v: any) => (v != null ? `${v}ms` : t('monitor.timeout'))} />
                  <Legend
                    onClick={handleLegendClick(setLatencyHidden)}
                    wrapperStyle={{ fontSize: 12, maxHeight: 60, overflowY: 'auto', cursor: 'pointer' }}
                    formatter={(value) => (
                      <span style={{ color: latencyHidden.has(value as string) ? '#ccc' : undefined }}>{value}</span>
                    )}
                  />
                  {forwards
                    .filter((f) => f.status === 1 && selectedForwards.has(f.id))
                    .map((f, i) => (
                      <Line
                        key={f.id}
                        type="monotone"
                        dataKey={f.name}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        dot={false}
                        connectNulls={false}
                        hide={latencyHidden.has(f.name)}
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
