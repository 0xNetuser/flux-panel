'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Server, Cpu, HardDrive, Network, RefreshCw, LayoutGrid, TableProperties } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getNodeHealth } from '@/lib/api/monitor';
import { useTranslation } from '@/lib/i18n';

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

function formatSpeed(bytesPerSec: number) {
  if (bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(Math.abs(bytesPerSec)) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
}

interface NodeHealth {
  id: number;
  name: string;
  serverIp: string;
  online: boolean;
  version: string;
  groupName?: string;
  cpuUsage?: number;
  memUsage?: number;
  uptime?: number;
  vRunning?: boolean;
  vVersion?: string;
  interfaces?: { name: string; ips: string[] }[];
  bytesReceived?: number;
  bytesTransmitted?: number;
  panelAddr?: string;
  runtime?: string;
}

export default function NodeMonitorPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('monitor_node_view') as 'card' | 'table') || 'card';
    }
    return 'card';
  });
  const initialLoad = useRef(true);

  // Persist view mode
  const handleViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('monitor_node_view', mode);
  };

  // Real-time speed tracking
  const [nodeSpeeds, setNodeSpeeds] = useState<Record<number, { uploadSpeed: number; downloadSpeed: number }>>({});
  const prevBytesRef = useRef<Record<number, { rx: number; tx: number; time: number }>>({});

  // Group nodes by groupName — sorted with named groups first, ungrouped last
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const ga = a.groupName || '';
      const gb = b.groupName || '';
      if (ga === '' && gb !== '') return 1;
      if (ga !== '' && gb === '') return -1;
      if (ga !== gb) return ga.localeCompare(gb);
      return 0;
    });
  }, [nodes]);

  // For card view: group into sections
  const groupedNodes = useMemo(() => {
    const groups = new Map<string, NodeHealth[]>();
    for (const node of nodes) {
      const key = node.groupName || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === '' && b !== '') return 1;
      if (a !== '' && b === '') return -1;
      return a.localeCompare(b);
    });
  }, [nodes]);

  const hasGroups = useMemo(() => nodes.some(n => n.groupName && n.groupName.length > 0), [nodes]);

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
                    setNodeSpeeds(s => ({
                      ...s,
                      [nodeId]: {
                        downloadSpeed: (rx - prev.rx) / dt,
                        uploadSpeed: (tx - prev.tx) / dt,
                      }
                    }));
                  } else {
                    setNodeSpeeds(s => ({
                      ...s,
                      [nodeId]: { downloadSpeed: 0, uploadSpeed: 0 }
                    }));
                  }
                }
              }
              prevBytesRef.current[nodeId] = { rx, tx, time: now };

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

    const healthRes = await getNodeHealth();
    if (healthRes.code === 0) setNodes(healthRes.data || []);

    setLoading(false);
    setRefreshing(false);
    initialLoad.current = false;
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => { loadData(); }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('common.noPermission')}</p>
      </div>
    );
  }

  const renderNodeCard = (node: NodeHealth) => (
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
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{node.serverIp}</span>
          {node.online && node.runtime && (
            <Badge variant={node.runtime === 'docker' ? 'outline' : 'secondary'} className="text-xs px-1.5 py-0">
              {node.runtime === 'docker' ? t('monitor.docker') : t('monitor.host')}
            </Badge>
          )}
        </div>
        {node.online && node.panelAddr && (
          <div className="text-xs text-muted-foreground truncate" title={node.panelAddr}>
            {t('monitor.panelAddr')}: {node.panelAddr}
          </div>
        )}
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
              {node.vRunning ? (
                <Badge variant="default" className="text-xs">
                  {node.vVersion?.match(/Xray\s+([\d.]+)/)?.[1] ? `Xray ${node.vVersion.match(/Xray\s+([\d.]+)/)![1]}` : (node.vVersion || t('monitor.running'))}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{t('monitor.notRunning')}</Badge>
              )}
            </div>
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
  );

  // Table: render a group header row when group changes
  const renderTableRows = () => {
    const rows: React.ReactNode[] = [];
    let lastGroup: string | null = null;
    for (const node of sortedNodes) {
      const group = node.groupName || '';
      if (hasGroups && group !== lastGroup) {
        rows.push(
          <TableRow key={`group-${group}`} className="bg-muted/50 hover:bg-muted/50">
            <TableCell colSpan={13} className="py-1.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group || t('monitor.ungrouped')}
            </TableCell>
          </TableRow>
        );
        lastGroup = group;
      }
      rows.push(
        <TableRow key={node.id}>
          <TableCell className="font-medium text-sm">{node.name}</TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Badge variant={node.online ? 'default' : 'secondary'} className="text-xs">
                {node.online ? t('common.online') : t('common.offline')}
              </Badge>
              {node.online && node.runtime && (
                <Badge variant={node.runtime === 'docker' ? 'outline' : 'secondary'} className="text-xs">
                  {node.runtime === 'docker' ? 'D' : 'H'}
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell className="text-sm">{node.serverIp}</TableCell>
          <TableCell className="text-sm">{node.online && node.cpuUsage != null ? `${node.cpuUsage.toFixed(1)}%` : '-'}</TableCell>
          <TableCell className="text-sm">{node.online && node.memUsage != null ? `${node.memUsage.toFixed(1)}%` : '-'}</TableCell>
          <TableCell className="text-sm">
            {node.online ? <Badge variant="default" className="text-xs">{t('monitor.running')}</Badge> : '-'}
          </TableCell>
          <TableCell className="text-sm">
            {node.online ? (
              node.vRunning ? (
                <Badge variant="default" className="text-xs">{t('monitor.running')}</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{t('monitor.notRunning')}</Badge>
              )
            ) : '-'}
          </TableCell>
          <TableCell className="text-sm text-green-600">
            {node.online && nodeSpeeds[node.id] ? formatSpeed(nodeSpeeds[node.id].uploadSpeed) : '-'}
          </TableCell>
          <TableCell className="text-sm text-blue-600">
            {node.online && nodeSpeeds[node.id] ? formatSpeed(nodeSpeeds[node.id].downloadSpeed) : '-'}
          </TableCell>
          <TableCell className="text-sm">
            {node.online && node.bytesTransmitted != null ? formatBytes(node.bytesTransmitted) : '-'}
          </TableCell>
          <TableCell className="text-sm">
            {node.online && node.bytesReceived != null ? formatBytes(node.bytesReceived) : '-'}
          </TableCell>
          <TableCell className="text-sm">{node.online && node.uptime !== undefined ? formatUptime(node.uptime) : '-'}</TableCell>
          <TableCell className="text-sm">{node.version || '-'}</TableCell>
        </TableRow>
      );
    }
    return rows;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('monitor.nodeMonitorTitle')}</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => handleViewMode('card')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t('monitor.cardView')}
            </button>
            <button
              className={`px-3 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => handleViewMode('table')}
            >
              <TableProperties className="h-3.5 w-3.5" />
              {t('monitor.tableView')}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {t('monitor.refresh')}
          </Button>
        </div>
      </div>

      {nodes.length === 0 && !loading ? (
        <p className="text-muted-foreground text-center py-8">{t('monitor.noNodes')}</p>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>{t('monitor.memory')}</TableHead>
                  <TableHead>GOST</TableHead>
                  <TableHead>Xray</TableHead>
                  <TableHead>{t('monitor.upload')}</TableHead>
                  <TableHead>{t('monitor.download')}</TableHead>
                  <TableHead>{t('monitor.totalUpload')}</TableHead>
                  <TableHead>{t('monitor.totalDownload')}</TableHead>
                  <TableHead>{t('monitor.uptime')}</TableHead>
                  <TableHead>{t('node.version')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderTableRows()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedNodes.map(([groupName, groupNodes]) => (
            <div key={groupName || '__ungrouped'}>
              {hasGroups && (
                <p className="px-1 pt-2 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {groupName || t('monitor.ungrouped')}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupNodes.map(renderNodeCard)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
