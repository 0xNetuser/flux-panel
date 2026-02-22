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
import { useTranslation } from '@/lib/i18n';

export default function ForwardPage() {
  const { isAdmin, gostEnabled } = useAuth();
  const { t } = useTranslation();
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
      remoteAddr: forward.remoteAddr?.includes(',') ? forward.remoteAddr.split(',').join('\n') : (forward.remoteAddr || ''),
      inPort: forward.inPort?.toString() || '',
      listenIp: forward.listenIp || '',
      strategy: forward.strategy || 'round',
      interfaceName: forward.interfaceName || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.tunnelId || !form.remoteAddr) {
      toast.error(t('common.fillRequired'));
      return;
    }
    const data: any = {
      name: form.name,
      tunnelId: parseInt(form.tunnelId),
      remoteAddr: form.remoteAddr.split('\n').map(s => s.trim()).filter(Boolean).join(','),
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
      toast.success(editingForward ? t('common.updateSuccess') : t('common.createSuccess'));
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('forward.confirmDelete'))) return;
    const res = await deleteForward(id);
    if (res.code === 0) { toast.success(t('common.deleteSuccess')); loadData(); }
    else toast.error(res.msg);
  };

  const handlePause = async (id: number) => {
    const res = await pauseForwardService(id);
    if (res.code === 0) { toast.success(t('forward.pauseSuccess')); loadData(); }
    else toast.error(res.msg);
  };

  const handleResume = async (id: number) => {
    const res = await resumeForwardService(id);
    if (res.code === 0) { toast.success(t('forward.resumeSuccess')); loadData(); }
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
      toast.error(t('forward.diagnoseFailed'));
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
        <p className="text-muted-foreground">{t('forward.noGostPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('forward.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('forward.createForward')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('forward.name')}</TableHead>
                <TableHead>{t('forward.tunnel')}</TableHead>
                <TableHead>{t('forward.entryPort')}</TableHead>
                <TableHead>{t('forward.targetAddr')}</TableHead>
                <TableHead>{t('forward.traffic')}</TableHead>
                <TableHead>{t('forward.latency')}</TableHead>
                <TableHead>{t('forward.status')}</TableHead>
                <TableHead>{t('forward.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : forwards.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                forwards.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.tunnelName}</TableCell>
                    <TableCell>{f.inIp}:{f.inPort}</TableCell>
                    <TableCell className="max-w-[200px] text-sm whitespace-pre-line">{f.remoteAddr?.includes(',') ? f.remoteAddr.split(',').join('\n') : f.remoteAddr}</TableCell>
                    <TableCell className="text-xs">{formatBytes(f.inFlow)} / {formatBytes(f.outFlow)}</TableCell>
                    <TableCell className="text-xs">
                      {f.status === 1 && latencyMap[f.id] ? (
                        latencyMap[f.id]!.success ? (
                          <span className={`font-mono ${latencyMap[f.id]!.latency > 500 ? 'text-red-600' : latencyMap[f.id]!.latency > 200 ? 'text-orange-600' : 'text-green-600'}`}>
                            {latencyMap[f.id]!.latency.toFixed(1)}ms
                          </span>
                        ) : (
                          <span className="text-destructive">{t('forward.timeout')}</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={f.status === 1 ? 'default' : f.status === 0 ? 'secondary' : 'destructive'}>
                        {f.status === 1 ? t('forward.running') : f.status === 0 ? t('forward.paused') : t('forward.error')}
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
            <DialogTitle>{t('forward.diagnoseResult')} — {diagnoseResult?.forwardName}</DialogTitle>
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
                        <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />{t('forward.success')}</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{t('forward.failed')}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.nodeName} → {r.targetIp}:{r.targetPort}
                    </div>
                    {r.success ? (
                      <div className="text-xs">
                        {t('forward.delayMs')} <span className="font-mono">{r.averageTime.toFixed(1)}ms</span>
                        {r.packetLoss > 0 && <span className="ml-2 text-orange-600">{t('forward.packetLoss')} {r.packetLoss.toFixed(0)}%</span>}
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
            <Button variant="outline" onClick={() => setDiagnoseDialogOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingForward ? t('forward.editForward') : t('forward.createForward')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('forward.name')}</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('forward.forwardName')} />
            </div>
            <div className="space-y-2">
              <Label>{t('forward.tunnel')}</Label>
              <Select value={form.tunnelId} onValueChange={v => setForm(p => ({ ...p, tunnelId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('forward.selectTunnel')} /></SelectTrigger>
                <SelectContent>
                  {tunnels.map((tun: any) => (
                    <SelectItem key={tun.id} value={tun.id.toString()}>{tun.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('forward.targetAddrMultiple')} <span className="text-muted-foreground font-normal">{t('forward.targetAddrHint')}</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                value={form.remoteAddr}
                onChange={e => setForm(p => ({ ...p, remoteAddr: e.target.value }))}
                placeholder={"1.2.3.4:8080\n5.6.7.8:8080"}
                rows={3}
              />
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
              // Build interfaceName options: check if current value is a known NIC or IP
              const nicNames = ifaces.map((iface: any) => iface.name);
              const knownIfaceValues = [...nicNames, ...allIps];
              const isCustomInterface = form.interfaceName && !knownIfaceValues.includes(form.interfaceName);

              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('forward.listenAddr')}</Label>
                      <Select value={isCustomListenIp ? '__custom__' : (form.listenIp || '::')} onValueChange={v => {
                        if (v === '__custom__') {
                          setForm(p => ({ ...p, listenIp: p.listenIp || '' }));
                        } else {
                          setForm(p => ({ ...p, listenIp: v }));
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder={t('forward.selectEntry')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="::">{t('forward.allInterfaces')}</SelectItem>
                          <SelectItem value="0.0.0.0">{t('forward.ipv4Only')}</SelectItem>
                          {ifaces.map((iface: any) =>
                            (iface.ips || []).map((ip: string) => (
                              <SelectItem key={`${iface.name}-${ip}`} value={ip}>
                                {iface.name} — {ip}
                              </SelectItem>
                            ))
                          )}
                          <SelectItem value="__custom__">{t('common.custom')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomListenIp && (
                        <Input
                          value={form.listenIp}
                          onChange={e => setForm(p => ({ ...p, listenIp: e.target.value }))}
                          placeholder={t('forward.ipAddrMultiple')}
                          className="mt-1"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t('forward.exitAddr')}</Label>
                      <Select value={isCustomInterface ? '__custom__' : (form.interfaceName || '__none__')} onValueChange={v => {
                        if (v === '__custom__') {
                          setForm(p => ({ ...p, interfaceName: p.interfaceName || '' }));
                        } else if (v === '__none__') {
                          setForm(p => ({ ...p, interfaceName: '' }));
                        } else {
                          setForm(p => ({ ...p, interfaceName: v }));
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder={t('forward.defaultRoute')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('forward.defaultRoute')}</SelectItem>
                          {ifaces.map((iface: any) => (
                            <SelectItem key={`nic-${iface.name}`} value={iface.name}>
                              {iface.name} — {t('forward.allIPs')}
                            </SelectItem>
                          ))}
                          {ifaces.flatMap((iface: any) =>
                            (iface.ips || []).map((ip: string) => (
                              <SelectItem key={`ip-${iface.name}-${ip}`} value={ip}>
                                {iface.name} — {ip}
                              </SelectItem>
                            ))
                          )}
                          <SelectItem value="__custom__">{t('common.custom')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomInterface && (
                        <Input
                          value={form.interfaceName}
                          onChange={e => setForm(p => ({ ...p, interfaceName: e.target.value }))}
                          placeholder={t('forward.nicOrIp')}
                          className="mt-1"
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('forward.entryPortOptional')}</Label>
                      <Input value={form.inPort} onChange={e => setForm(p => ({ ...p, inPort: e.target.value }))} placeholder={t('forward.autoAssign')} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('forward.loadStrategy')}</Label>
                      <Select value={form.strategy} onValueChange={v => setForm(p => ({ ...p, strategy: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round">{t('forward.roundRobin')}</SelectItem>
                          <SelectItem value="random">{t('forward.random')}</SelectItem>
                          <SelectItem value="fifo">{t('forward.failover')}</SelectItem>
                          <SelectItem value="hash">{t('forward.hash')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{editingForward ? t('common.update') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
