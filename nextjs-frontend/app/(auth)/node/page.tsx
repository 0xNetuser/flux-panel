'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, Terminal, Container, Copy, Eye, EyeOff, RefreshCw, ArrowUpDown, Network, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getNodeList, createNode, updateNode, deleteNode, getNodeInstallCommand, getNodeDockerCommand, reconcileNode, updateNodeBinary } from '@/lib/api/node';
import { switchXrayVersion, getXrayVersions } from '@/lib/api/xray-node';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getVersion } from '@/lib/api/system';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export default function NodePage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [form, setForm] = useState({ name: '', entryIps: '', serverIp: '', portSta: '', portEnd: '', secret: '' });
  const [commandDialog, setCommandDialog] = useState(false);
  const [commandContent, setCommandContent] = useState('');
  const [commandTitle, setCommandTitle] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [panelVersion, setPanelVersion] = useState('');

  const initialLoad = useRef(true);

  const loadData = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const [res, ver] = await Promise.all([getNodeList(), getVersion()]);
    if (res.code === 0) setNodes(res.data || []);
    if (ver) setPanelVersion(ver);
    setLoading(false);
    initialLoad.current = false;
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => { loadData(); }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleCreate = () => {
    setEditingNode(null);
    setForm({ name: '', entryIps: '', serverIp: '', portSta: '10000', portEnd: '60000', secret: '' });
    setShowSecret(false);
    setDialogOpen(true);
  };

  const handleEdit = (node: any) => {
    setEditingNode(node);
    setForm({
      name: node.name || '',
      entryIps: node.entryIps?.includes(',') ? node.entryIps.split(',').join('\n') : (node.entryIps || ''),
      serverIp: node.serverIp || '',
      portSta: node.portSta?.toString() || '',
      portEnd: node.portEnd?.toString() || '',
      secret: node.secret || '',
    });
    setShowSecret(false);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.serverIp) {
      toast.error(t('common.fillRequired'));
      return;
    }
    const data: any = {
      name: form.name,
      entryIps: form.entryIps.split('\n').map(s => s.trim()).filter(Boolean).join(','),
      serverIp: form.serverIp,
      secret: form.secret || undefined,
    };
    if (form.portSta) data.portSta = parseInt(form.portSta);
    if (form.portEnd) data.portEnd = parseInt(form.portEnd);

    let res;
    if (editingNode) {
      res = await updateNode({ ...data, id: editingNode.id });
    } else {
      res = await createNode(data);
    }

    if (res.code === 0) {
      toast.success(editingNode ? t('common.updateSuccess') : t('common.createSuccess'));
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('node.confirmDeleteNode'))) return;
    const res = await deleteNode(id);
    if (res.code === 0) { toast.success(t('common.deleteSuccess')); loadData(); }
    else toast.error(res.msg);
  };

  const handleInstallCommand = async (id: number) => {
    const res = await getNodeInstallCommand(id);
    if (res.code === 0) {
      setCommandTitle(t('node.installCommand'));
      setCommandContent(res.data || '');
      setCommandDialog(true);
    } else {
      toast.error(res.msg);
    }
  };

  const handleDockerCommand = async (id: number) => {
    const res = await getNodeDockerCommand(id);
    if (res.code === 0) {
      setCommandTitle(t('node.dockerCommand'));
      setCommandContent(res.data || '');
      setCommandDialog(true);
    } else {
      toast.error(res.msg);
    }
  };

  const [ifaceNode, setIfaceNode] = useState<any>(null);
  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [xrayVersionDialog, setXrayVersionDialog] = useState(false);
  const [xrayVersionNode, setXrayVersionNode] = useState<any>(null);
  const [xrayTargetVersion, setXrayTargetVersion] = useState('');
  const [xraySwitching, setXraySwitching] = useState(false);
  const [xrayVersions, setXrayVersions] = useState<{version: string, publishedAt: string}[]>([]);
  const [xrayVersionsLoading, setXrayVersionsLoading] = useState(false);
  const [xrayVersionsFailed, setXrayVersionsFailed] = useState(false);

  const handleXrayVersionSwitch = async (node: any) => {
    setXrayVersionNode(node);
    setXrayTargetVersion('');
    setXrayVersionsFailed(false);
    setXrayVersionDialog(true);
    setXrayVersionsLoading(true);
    try {
      const res = await getXrayVersions();
      if (res.code === 0 && res.data) {
        setXrayVersions(res.data);
      } else {
        setXrayVersionsFailed(true);
      }
    } catch {
      setXrayVersionsFailed(true);
    } finally {
      setXrayVersionsLoading(false);
    }
  };

  const handleXrayVersionSubmit = async () => {
    if (!xrayTargetVersion.trim()) {
      toast.error(t('node.selectTargetVersion'));
      return;
    }
    setXraySwitching(true);
    try {
      const res = await switchXrayVersion(xrayVersionNode.id, xrayTargetVersion.trim());
      if (res.code === 0) {
        toast.success(t('node.versionSwitchStarted'));
        setXrayVersionDialog(false);
      } else {
        toast.error(res.msg || t('node.switchFailed'));
      }
    } finally {
      setXraySwitching(false);
    }
  };

  const handleReconcile = async (id: number) => {
    setReconcilingId(id);
    try {
      const res = await reconcileNode(id);
      if (res.code === 0) {
        const d = res.data;
        toast.success(t('node.syncResult', { limiters: d.limiters, forwards: d.forwards, inbounds: d.inbounds, certs: d.certs, duration: d.duration }));
        if (d.errors && d.errors.length > 0) {
          toast.warning(t('node.syncErrors', { count: d.errors.length, first: d.errors[0] }));
        }
      } else {
        toast.error(res.msg);
      }
    } finally {
      setReconcilingId(null);
    }
  };

  const handleUpdateBinary = async (node: any) => {
    if (!confirm(t('node.confirmUpdateBinary', { name: node.name }))) return;
    setUpdatingId(node.id);
    try {
      const res = await updateNodeBinary(node.id);
      if (res.code === 0) {
        toast.success(t('node.updateBinarySent'));
      } else {
        toast.error(res.msg || t('common.networkError'));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copySuccess'));
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}${t('node.days')}${hours}${t('node.hours')}${mins}${t('node.minutes')}`;
    if (hours > 0) return `${hours}${t('node.hours')}${mins}${t('node.minutes')}`;
    return `${mins}${t('node.minutes')}`;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('node.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('node.createNode')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('node.name')}</TableHead>
                <TableHead>{t('node.entryIp')}</TableHead>
                <TableHead>{t('node.serverIp')}</TableHead>
                <TableHead>{t('node.portRange')}</TableHead>
                <TableHead>{t('node.status')}</TableHead>
                <TableHead>{t('node.version')}</TableHead>
                <TableHead>{t('node.cpuMem')}</TableHead>
                <TableHead>{t('node.uptime')}</TableHead>
                <TableHead>{t('node.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : nodes.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                nodes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.name}</TableCell>
                    <TableCell className="text-sm whitespace-pre-line">{n.entryIps ? n.entryIps.split(',').join('\n') : (n.ip || '-')}</TableCell>
                    <TableCell className="text-sm">{n.serverIp}</TableCell>
                    <TableCell>{n.portSta} - {n.portEnd}</TableCell>
                    <TableCell>
                      <Badge variant={n.status === 1 ? 'default' : 'destructive'}>
                        {n.status === 1 ? t('common.online') : t('common.offline')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {n.version || '-'}
                      {n.version && panelVersion && n.version !== panelVersion && n.version !== 'dev' && compareVersions(n.version, panelVersion) < 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-1 h-5 px-1.5 text-xs text-orange-600 border-orange-400 hover:bg-orange-50"
                          onClick={() => handleUpdateBinary(n)}
                          disabled={updatingId === n.id}
                        >
                          {updatingId === n.id ? (
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="mr-1 h-3 w-3" />
                          )}
                          {updatingId === n.id ? t('node.updatingBinary') : t('node.updateBinary')}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {n.cpuUsage != null ? `${n.cpuUsage.toFixed(1)}%` : '-'} / {n.memUsage != null ? `${n.memUsage.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{formatUptime(n.uptime)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(n)} title="编辑">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setIfaceNode(n)} title={t('node.nicInfo')} disabled={!n.interfaces?.length}>
                          <Network className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleXrayVersionSwitch(n)} title={t('node.xrayVersionTitle')}>
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleReconcile(n.id)} disabled={reconcilingId === n.id} title={t('node.syncConfig')}>
                          <RefreshCw className={`h-4 w-4 ${reconcilingId === n.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleInstallCommand(n.id)} title={t('node.installCommand')}>
                          <Terminal className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDockerCommand(n.id)} title={t('node.dockerCommand')}>
                          <Container className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)} className="text-destructive" title="删除">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Node Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNode ? t('node.editNode') : t('node.createNodeTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('node.name')}</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('node.nodeName')} />
            </div>
            <div className="space-y-2">
              <Label>{t('node.entryIpList')}</Label>
              <Textarea
                value={form.entryIps}
                onChange={e => setForm(p => ({ ...p, entryIps: e.target.value }))}
                placeholder={"每行一个IP，例如:\n1.2.3.4\n5.6.7.8\n2001:db8::1"}
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('node.entryIpDesc')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('node.serverIpLabel')}</Label>
              <Input value={form.serverIp} onChange={e => setForm(p => ({ ...p, serverIp: e.target.value }))} placeholder={t('node.serverIpPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('node.startPort')}</Label>
                <Input value={form.portSta} onChange={e => setForm(p => ({ ...p, portSta: e.target.value }))} placeholder="10000" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>{t('node.endPort')}</Label>
                <Input value={form.portEnd} onChange={e => setForm(p => ({ ...p, portEnd: e.target.value }))} placeholder="60000" autoComplete="off" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('node.commSecret')}</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={form.secret}
                  onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
                  placeholder={t('node.secretAutoGenerate')}
                  readOnly={!!editingNode}
                  className={editingNode ? 'bg-muted' : ''}
                  autoComplete="off"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {editingNode && <p className="text-xs text-muted-foreground">{t('node.secretReadonly')}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{editingNode ? t('common.update') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xray Version Switch Dialog */}
      <Dialog open={xrayVersionDialog} onOpenChange={setXrayVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('node.xrayVersionTitle')} — {xrayVersionNode?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('node.currentVersion')}</Label>
              <p className="text-sm text-muted-foreground">{xrayVersionNode?.xrayVersion || t('node.unknown')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('node.targetVersion')}</Label>
              {xrayVersionsFailed ? (
                <>
                  <Input
                    value={xrayTargetVersion}
                    onChange={e => setXrayTargetVersion(e.target.value)}
                    placeholder={t('node.versionInputPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">{t('node.versionListFailed')}</p>
                </>
              ) : (
                <Select value={xrayTargetVersion} onValueChange={setXrayTargetVersion} disabled={xrayVersionsLoading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={xrayVersionsLoading ? t('node.loadingVersions') : t('node.selectVersion')} />
                  </SelectTrigger>
                  <SelectContent>
                    {xrayVersionsLoading ? (
                      <SelectItem value="_loading" disabled>{t('node.loadingVersions')}</SelectItem>
                    ) : (
                      xrayVersions.map((v) => (
                        <SelectItem key={v.version} value={v.version}>
                          {v.version}{xrayVersionNode?.xrayVersion === v.version ? ` (${t('node.current')})` : ''}
                          {v.publishedAt && <span className="text-muted-foreground ml-2 text-xs">{v.publishedAt.slice(0, 10)}</span>}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setXrayVersionDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleXrayVersionSubmit} disabled={xraySwitching}>
              {xraySwitching ? t('node.switching') : t('node.switchVersion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NIC Info Dialog */}
      <Dialog open={!!ifaceNode} onOpenChange={() => setIfaceNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('node.nicInfo')} — {ifaceNode?.name}</DialogTitle>
          </DialogHeader>
          {ifaceNode?.interfaces?.length ? (
            <div className="space-y-3">
              {ifaceNode.interfaces.map((iface: any) => (
                <div key={iface.name} className="rounded border p-3">
                  <div className="text-sm font-medium">{iface.name}</div>
                  <div className="mt-1 space-y-0.5">
                    {(iface.ips || []).map((ip: string) => (
                      <div key={ip} className="text-sm text-muted-foreground font-mono">{ip}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('node.nodeOfflineOrNoData')}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIfaceNode(null)}>{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Command Dialog */}
      <Dialog open={commandDialog} onOpenChange={setCommandDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{commandTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto whitespace-pre-wrap break-all">
              {commandContent}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(commandContent)}
            >
              <Copy className="mr-2 h-3 w-3" />{t('common.copy')}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommandDialog(false)}>{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
