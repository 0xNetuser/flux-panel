'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pause, Play, Edit2, Stethoscope, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getForwardList, createForward, updateForward, deleteForward, pauseForwardService, resumeForwardService, diagnoseForward } from '@/lib/api/forward';
import { getLatencyHistory } from '@/lib/api/monitor';
import { userTunnel } from '@/lib/api/tunnel';
import { getAccessibleNodeList } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';

export default function ForwardPage() {
  const { isAdmin, gostEnabled } = useAuth();
  const [forwards, setForwards] = useState<any[]>([]);
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForward, setEditingForward] = useState<any>(null);
  const [form, setForm] = useState({ name: '', tunnelId: '', remoteAddr: '', inPort: '', listenIp: '', strategy: 'round', interfaceName: '' });
  const [diagnoseDialogOpen, setDiagnoseDialogOpen] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [diagnosing, setDiagnosing] = useState<number | null>(null);
  const [latencyMap, setLatencyMap] = useState<Record<number, { latency: number; success: boolean } | null>>({});
  const initialLoad = useRef(true);

  const loadLatency = useCallback(async (fwds: any[]) => {
    const active = fwds.filter((f: any) => f.status === 1);
    if (active.length === 0) { setLatencyMap({}); return; }
    const results = await Promise.all(
      active.map(async (f: any) => {
        try {
          const res = await getLatencyHistory(f.id, 1);
          if (res.code === 0 && res.data && (res.data as any[]).length > 0) {
            const records = res.data as any[];
            const last = records[records.length - 1];
            return { id: f.id, latency: last.latency, success: last.success };
          }
        } catch {}
        return { id: f.id, latency: 0, success: false };
      })
    );
    const map: Record<number, { latency: number; success: boolean }> = {};
    for (const r of results) {
      map[r.id] = { latency: r.latency, success: r.success };
    }
    setLatencyMap(map);
  }, []);

  const loadData = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const [forwardRes, tunnelRes, nodeRes] = await Promise.all([getForwardList(), userTunnel(), getAccessibleNodeList()]);
    const fwds = forwardRes.code === 0 ? (forwardRes.data || []) : [];
    if (forwardRes.code === 0) setForwards(fwds);
    if (tunnelRes.code === 0) setTunnels(tunnelRes.data || []);
    if (nodeRes.code === 0) setNodes(nodeRes.data || []);
    setLoading(false);
    initialLoad.current = false;
    loadLatency(fwds);
  }, [loadLatency]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => { loadData(); }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleCreate = () => {
    setEditingForward(null);
    setForm({ name: '', tunnelId: '', remoteAddr: '', inPort: '', listenIp: '', strategy: 'round', interfaceName: '' });
    setDialogOpen(true);
  };

  const handleEdit = (forward: any) => {
    setEditingForward(forward);
    setForm({
      name: forward.name,
      tunnelId: forward.tunnelId?.toString(),
      remoteAddr: forward.remoteAddr,
      inPort: forward.inPort?.toString() || '',
      listenIp: forward.listenIp || '',
      strategy: forward.strategy || 'round',
      interfaceName: forward.interfaceName || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.tunnelId || !form.remoteAddr) {
      toast.error('请填写必要字段');
      return;
    }
    const data: any = {
      name: form.name,
      tunnelId: parseInt(form.tunnelId),
      remoteAddr: form.remoteAddr,
      listenIp: form.listenIp || undefined,
      strategy: form.strategy,
      interfaceName: form.interfaceName || null,
    };
    if (form.inPort) data.inPort = parseInt(form.inPort);

    let res;
    if (editingForward) {
      res = await updateForward({ ...data, id: editingForward.id });
    } else {
      res = await createForward(data);
    }

    if (res.code === 0) {
      toast.success(editingForward ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此转发?')) return;
    const res = await deleteForward(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const handlePause = async (id: number) => {
    const res = await pauseForwardService(id);
    if (res.code === 0) { toast.success('已暂停'); loadData(); }
    else toast.error(res.msg);
  };

  const handleResume = async (id: number) => {
    const res = await resumeForwardService(id);
    if (res.code === 0) { toast.success('已恢复'); loadData(); }
    else toast.error(res.msg);
  };

  const handleDiagnose = async (id: number) => {
    setDiagnosing(id);
    try {
      const res = await diagnoseForward(id);
      if (res.code === 0) {
        setDiagnoseResult(res.data);
        setDiagnoseDialogOpen(true);
      } else {
        toast.error(res.msg);
      }
    } catch {
      toast.error('诊断请求失败');
    } finally {
      setDiagnosing(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAdmin && !gostEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">你没有 GOST 转发权限，请联系管理员</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">转发管理</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建转发</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>隧道</TableHead>
                <TableHead>入口端口</TableHead>
                <TableHead>目标地址</TableHead>
                <TableHead>流量</TableHead>
                <TableHead>延迟</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : forwards.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                forwards.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.tunnelName}</TableCell>
                    <TableCell>{f.inIp}:{f.inPort}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{f.remoteAddr}</TableCell>
                    <TableCell className="text-xs">{formatBytes(f.inFlow)} / {formatBytes(f.outFlow)}</TableCell>
                    <TableCell className="text-xs">
                      {f.status === 1 && latencyMap[f.id] ? (
                        latencyMap[f.id]!.success ? (
                          <span className={`font-mono ${latencyMap[f.id]!.latency > 500 ? 'text-red-600' : latencyMap[f.id]!.latency > 200 ? 'text-orange-600' : 'text-green-600'}`}>
                            {latencyMap[f.id]!.latency.toFixed(1)}ms
                          </span>
                        ) : (
                          <span className="text-destructive">超时</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={f.status === 1 ? 'default' : f.status === 0 ? 'secondary' : 'destructive'}>
                        {f.status === 1 ? '运行中' : f.status === 0 ? '已暂停' : '异常'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}><Edit2 className="h-4 w-4" /></Button>
                        {f.status === 1 ? (
                          <Button variant="ghost" size="icon" onClick={() => handlePause(f.id)}><Pause className="h-4 w-4" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => handleResume(f.id)}><Play className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDiagnose(f.id)} disabled={diagnosing === f.id}>
                          <Stethoscope className={`h-4 w-4 ${diagnosing === f.id ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diagnose Dialog */}
      <Dialog open={diagnoseDialogOpen} onOpenChange={setDiagnoseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>诊断结果 — {diagnoseResult?.forwardName}</DialogTitle>
          </DialogHeader>
          {diagnoseResult && (
            <div className="space-y-3">
              <div className="flex gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{diagnoseResult.tunnelType}</Badge>
              </div>
              <div className="space-y-2">
                {diagnoseResult.results?.map((r: any, i: number) => (
                  <div key={i} className="rounded border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.description}</span>
                      {r.success ? (
                        <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />成功</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />失败</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.nodeName} → {r.targetIp}:{r.targetPort}
                    </div>
                    {r.success ? (
                      <div className="text-xs">
                        延迟: <span className="font-mono">{r.averageTime.toFixed(1)}ms</span>
                        {r.packetLoss > 0 && <span className="ml-2 text-orange-600">丢包: {r.packetLoss.toFixed(0)}%</span>}
                      </div>
                    ) : (
                      <div className="text-xs text-destructive">{r.message}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiagnoseDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingForward ? '编辑转发' : '创建转发'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="转发名称" />
            </div>
            <div className="space-y-2">
              <Label>隧道</Label>
              <Select value={form.tunnelId} onValueChange={v => setForm(p => ({ ...p, tunnelId: v }))}>
                <SelectTrigger><SelectValue placeholder="选择隧道" /></SelectTrigger>
                <SelectContent>
                  {tunnels.map((t: any) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>目标地址</Label>
              <Input value={form.remoteAddr} onChange={e => setForm(p => ({ ...p, remoteAddr: e.target.value }))} placeholder="ip:port" />
            </div>
            {(() => {
              const selectedTunnel = tunnels.find((t: any) => t.id?.toString() === form.tunnelId);
              const entryNode = selectedTunnel ? nodes.find((n: any) => n.id === selectedTunnel.inNodeId) : null;
              const ifaces: { name: string; ips: string[] }[] = entryNode?.interfaces || [];
              // Flatten all IPs from all interfaces for the IP-based dropdown
              const allIps = ifaces.flatMap((iface: any) => iface.ips || []);
              // Build listenIp options: check if current value is a known IP or NIC-derived
              const knownValues = ['', '::', '0.0.0.0', ...allIps];
              const isCustomListenIp = form.listenIp && !knownValues.includes(form.listenIp);
              // Build interfaceName options: check if current value is a known NIC
              const nicNames = ifaces.map((iface: any) => iface.name);
              const isCustomInterface = form.interfaceName && !nicNames.includes(form.interfaceName);

              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>入口网卡 (可选)</Label>
                      <Select value={isCustomListenIp ? '__custom__' : (form.listenIp || '::')} onValueChange={v => {
                        if (v === '__custom__') {
                          setForm(p => ({ ...p, listenIp: p.listenIp || '' }));
                        } else {
                          setForm(p => ({ ...p, listenIp: v }));
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="选择入口" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="::">全部接口 (::)</SelectItem>
                          <SelectItem value="0.0.0.0">仅IPv4 (0.0.0.0)</SelectItem>
                          {ifaces.map((iface: any) =>
                            (iface.ips || []).map((ip: string) => (
                              <SelectItem key={`${iface.name}-${ip}`} value={ip}>
                                {iface.name} — {ip}
                              </SelectItem>
                            ))
                          )}
                          <SelectItem value="__custom__">自定义...</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomListenIp && (
                        <Input
                          value={form.listenIp}
                          onChange={e => setForm(p => ({ ...p, listenIp: e.target.value }))}
                          placeholder="IP地址，多个用逗号分隔"
                          className="mt-1"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>出口网卡 (可选)</Label>
                      <Select value={isCustomInterface ? '__custom__' : (form.interfaceName || '__none__')} onValueChange={v => {
                        if (v === '__custom__') {
                          setForm(p => ({ ...p, interfaceName: p.interfaceName || '' }));
                        } else if (v === '__none__') {
                          setForm(p => ({ ...p, interfaceName: '' }));
                        } else {
                          setForm(p => ({ ...p, interfaceName: v }));
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="默认路由" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">默认路由</SelectItem>
                          {ifaces.map((iface: any) => (
                            <SelectItem key={iface.name} value={iface.name}>
                              {iface.name}{iface.ips?.length ? ` (${iface.ips.join(', ')})` : ''}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">自定义...</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomInterface && (
                        <Input
                          value={form.interfaceName}
                          onChange={e => setForm(p => ({ ...p, interfaceName: e.target.value }))}
                          placeholder="网卡名称，如 eth0"
                          className="mt-1"
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>入口端口 (可选)</Label>
                      <Input value={form.inPort} onChange={e => setForm(p => ({ ...p, inPort: e.target.value }))} placeholder="自动分配" />
                    </div>
                    <div className="space-y-2">
                      <Label>负载策略</Label>
                      <Select value={form.strategy} onValueChange={v => setForm(p => ({ ...p, strategy: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round">轮询 (round)</SelectItem>
                          <SelectItem value="random">随机 (random)</SelectItem>
                          <SelectItem value="fifo">灾备切换 (fifo)</SelectItem>
                          <SelectItem value="hash">哈希 (hash)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingForward ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
