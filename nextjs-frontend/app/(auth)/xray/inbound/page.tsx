'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Edit2, Play, Pause, ChevronRight, ChevronDown,
  RotateCcw, Copy, RefreshCw, QrCode, Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import {
  createXrayInbound, getXrayInboundList, updateXrayInbound,
  deleteXrayInbound, enableXrayInbound, disableXrayInbound,
} from '@/lib/api/xray-inbound';
import {
  createXrayClient, getXrayClientList, updateXrayClient,
  deleteXrayClient, resetXrayClientTraffic, getXrayClientLink,
} from '@/lib/api/xray-client';
import { getAccessibleNodeList } from '@/lib/api/node';
import { getAllUsers } from '@/lib/api/user';
import { useAuth } from '@/lib/hooks/use-auth';
import { randomUUID } from '@/lib/utils/random';
import InboundDialog from './_components/inbound-dialog';
import { useTranslation } from '@/lib/i18n';

export default function XrayInboundPage() {
  const { isAdmin, xrayEnabled } = useAuth();
  const { t } = useTranslation();
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInbound, setEditingInbound] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [operatingIds, setOperatingIds] = useState<Set<number>>(new Set());

  // Client inline management
  const [expandedInbound, setExpandedInbound] = useState<number | null>(null);
  const [clients, setClients] = useState<Record<number, any[]>>({});
  const [clientsLoading, setClientsLoading] = useState<Record<number, boolean>>({});

  // Client dialog
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clientInboundId, setClientInboundId] = useState<number | null>(null);
  const [clientForm, setClientForm] = useState({
    userId: '', email: '', uuid: '', flow: '',
    alterId: '0', totalTraffic: '', expTime: '', remark: '',
    limitIp: '0', reset: '0',
  });

  // QR dialog
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [qrRemark, setQrRemark] = useState('');

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const promises: Promise<any>[] = [getXrayInboundList(), getAccessibleNodeList()];
    if (isAdmin) promises.push(getAllUsers());

    const results = await Promise.all(promises);
    if (results[0].code === 0) setInbounds(results[0].data || []);
    if (results[1].code === 0) setNodes(results[1].data || []);
    if (isAdmin && results[2]?.code === 0) setUsers(results[2].data || []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadClients = useCallback(async (inboundId: number) => {
    setClientsLoading(prev => ({ ...prev, [inboundId]: true }));
    const res = await getXrayClientList({ inboundId });
    if (res.code === 0) {
      setClients(prev => ({ ...prev, [inboundId]: res.data || [] }));
    }
    setClientsLoading(prev => ({ ...prev, [inboundId]: false }));
  }, []);

  const getNodeName = (nodeId: number) => {
    const node = nodes.find((n: any) => n.id === nodeId);
    return node ? node.name : `#${nodeId}`;
  };

  const getUserName = (userId: number) => {
    const u = users.find((u: any) => u.id === userId);
    return u ? u.user : `#${userId}`;
  };

  const getProtocolBadgeVariant = (protocol: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (protocol?.toLowerCase()) {
      case 'vmess': return 'secondary';
      case 'vless': return 'secondary';
      case 'trojan': return 'destructive';
      case 'shadowsocks':
      case 'ss': return 'outline';
      default: return 'secondary';
    }
  };

  const getTransportInfo = (ib: any) => {
    try {
      const stream = JSON.parse(ib.streamSettingsJson || ib.streamSettings || '{}');
      const network = stream.network || 'tcp';
      const security = stream.security || 'none';
      return `${network}${security !== 'none' ? '+' + security : ''}`;
    } catch {
      return '-';
    }
  };

  const getInboundProtocol = (inboundId: number) => {
    const ib = inbounds.find((i: any) => i.id === inboundId);
    return ib?.protocol || '';
  };

  const getInboundSecurity = (inboundId: number) => {
    const ib = inbounds.find((i: any) => i.id === inboundId);
    if (!ib) return 'none';
    try {
      const stream = JSON.parse(ib.streamSettingsJson || ib.streamSettings || '{}');
      return stream.security || 'none';
    } catch {
      return 'none';
    }
  };

  // ── Inbound handlers ──

  const handleCreate = () => {
    setEditingInbound(null);
    setDialogOpen(true);
  };

  const handleEdit = (inbound: any) => {
    setEditingInbound(inbound);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      let res;
      if (data.id) {
        res = await updateXrayInbound(data);
      } else {
        res = await createXrayInbound(data);
      }

      if (res.code === 0) {
        toast.success(data.id ? t('common.updateSuccess') : t('common.createSuccess'));
        if (res.msg && res.msg !== '操作成功') {
          toast.warning(res.msg);
        }
        setDialogOpen(false);
        loadData();
      } else {
        toast.error(res.msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('xrayInbound.confirmDeleteInbound'))) return;
    setOperatingIds(prev => new Set(prev).add(id));
    try {
      const res = await deleteXrayInbound(id);
      if (res.code === 0) {
        toast.success(t('common.deleteSuccess'));
        loadData();
      } else {
        toast.error(res.msg);
      }
    } finally {
      setOperatingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleToggleEnable = async (inbound: any) => {
    setOperatingIds(prev => new Set(prev).add(inbound.id));
    try {
      const res = inbound.enable
        ? await disableXrayInbound(inbound.id)
        : await enableXrayInbound(inbound.id);
      if (res.code === 0) {
        toast.success(inbound.enable ? t('xrayInbound.disabledStatus') : t('xrayInbound.enabledStatus'));
        loadData();
      } else {
        toast.error(res.msg);
      }
    } finally {
      setOperatingIds(prev => { const s = new Set(prev); s.delete(inbound.id); return s; });
    }
  };

  const handleToggleExpand = (inboundId: number) => {
    if (expandedInbound === inboundId) {
      setExpandedInbound(null);
    } else {
      setExpandedInbound(inboundId);
      if (!clients[inboundId]) {
        loadClients(inboundId);
      }
    }
  };

  // ── Client handlers ──

  const handleClientCreate = (inboundId: number) => {
    setEditingClient(null);
    setClientInboundId(inboundId);
    setClientForm({
      userId: '', email: '', uuid: randomUUID(), flow: '',
      alterId: '0', totalTraffic: '', expTime: '', remark: '',
      limitIp: '0', reset: '0',
    });
    setClientDialogOpen(true);
  };

  const handleClientEdit = (client: any) => {
    setEditingClient(client);
    setClientInboundId(client.inboundId);
    setClientForm({
      userId: client.userId?.toString() || '',
      email: client.email || '',
      uuid: client.uuidOrPassword || client.uuid || client.id || '',
      flow: client.flow || '',
      alterId: client.alterId?.toString() || '0',
      totalTraffic: client.totalTraffic ? (client.totalTraffic / (1024 * 1024 * 1024)).toString() : '',
      expTime: client.expTime ? new Date(client.expTime).toISOString().slice(0, 16) : '',
      remark: client.remark || '',
      limitIp: client.limitIp?.toString() || '0',
      reset: client.reset?.toString() || '0',
    });
    setClientDialogOpen(true);
  };

  const handleClientSubmit = async () => {
    if (!clientInboundId || !clientForm.uuid) {
      toast.error(t('xrayInbound.fillUuid'));
      return;
    }

    const data: any = {
      inboundId: clientInboundId,
      email: clientForm.email || undefined,
      uuidOrPassword: clientForm.uuid || undefined,
      flow: clientForm.flow || undefined,
      alterId: parseInt(clientForm.alterId) || 0,
      limitIp: parseInt(clientForm.limitIp) || 0,
      reset: parseInt(clientForm.reset) || 0,
      remark: clientForm.remark || undefined,
    };
    if (clientForm.userId) data.userId = parseInt(clientForm.userId);
    if (clientForm.totalTraffic) data.totalTraffic = parseFloat(clientForm.totalTraffic) * 1024 * 1024 * 1024;
    if (clientForm.expTime) data.expTime = new Date(clientForm.expTime).getTime();

    let res;
    if (editingClient) {
      res = await updateXrayClient({ ...data, id: editingClient.id });
    } else {
      res = await createXrayClient(data);
    }

    if (res.code === 0) {
      toast.success(editingClient ? t('common.updateSuccess') : t('common.createSuccess'));
      setClientDialogOpen(false);
      loadClients(clientInboundId);
      loadData(); // refresh client counts
    } else {
      toast.error(res.msg);
    }
  };

  const handleClientDelete = async (id: number, inboundId: number) => {
    if (!confirm(t('xrayInbound.confirmDeleteClient'))) return;
    const res = await deleteXrayClient(id);
    if (res.code === 0) {
      toast.success(t('common.deleteSuccess'));
      loadClients(inboundId);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleResetTraffic = async (id: number, inboundId: number) => {
    if (!confirm(t('xrayInbound.confirmResetTraffic'))) return;
    const res = await resetXrayClientTraffic(id);
    if (res.code === 0) {
      toast.success(t('xrayInbound.trafficReset'));
      loadClients(inboundId);
    } else {
      toast.error(res.msg);
    }
  };

  const handleCopyLink = async (id: number) => {
    try {
      const res = await getXrayClientLink(id);
      if (res.code === 0 && res.data?.link) {
        await navigator.clipboard.writeText(res.data.link);
        toast.success(t('xrayInbound.linkCopied'));
      } else {
        toast.error(res.msg || t('xrayInbound.noLink'));
      }
    } catch {
      toast.error(t('xrayInbound.linkFailed'));
    }
  };

  const handleShowQR = async (id: number) => {
    try {
      const res = await getXrayClientLink(id);
      if (res.code === 0 && res.data?.link) {
        setQrLink(res.data.link);
        setQrRemark(res.data.remark || '');
        setQrDialogOpen(true);
      } else {
        toast.error(res.msg || t('xrayInbound.noLink'));
      }
    } catch {
      toast.error(t('xrayInbound.linkFailed'));
    }
  };

  if (!isAdmin && !xrayEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('xrayInbound.noPermission')}</p>
      </div>
    );
  }

  // Determine if protocol supports flow (VLESS with TLS/Reality)
  const showFlowSelect = clientInboundId != null && getInboundProtocol(clientInboundId).toLowerCase() === 'vless'
    && ['tls', 'reality'].includes(getInboundSecurity(clientInboundId));

  // Determine if protocol is VMess (show security select)
  const isVMessClient = clientInboundId != null && getInboundProtocol(clientInboundId).toLowerCase() === 'vmess';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('xrayInbound.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('xrayInbound.createInbound')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{t('xrayInbound.remark')}</TableHead>
                <TableHead>{t('xrayInbound.protocol')}</TableHead>
                <TableHead>{t('xrayInbound.transportSecurity')}</TableHead>
                <TableHead>{t('xrayInbound.listenAddr')}</TableHead>
                <TableHead>{t('xrayInbound.node')}</TableHead>
                <TableHead>{t('xrayInbound.clientCount')}</TableHead>
                <TableHead>{t('xrayInbound.status')}</TableHead>
                <TableHead>{t('xrayInbound.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : inbounds.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                inbounds.map((ib) => (
                  <Fragment key={ib.id}>
                    <TableRow className="cursor-pointer" onClick={() => handleToggleExpand(ib.id)}>
                      <TableCell className="w-8 px-2">
                        {expandedInbound === ib.id
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell className="font-medium">{ib.remark || ib.tag || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getProtocolBadgeVariant(ib.protocol)}>
                          {ib.protocol?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{getTransportInfo(ib)}</TableCell>
                      <TableCell className="text-sm font-mono">{ib.listen || '::'}:{ib.port}</TableCell>
                      <TableCell>{getNodeName(ib.nodeId)}</TableCell>
                      <TableCell>{ib.clientCount ?? ib.clients ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={ib.enable ? 'default' : 'secondary'}>
                          {ib.enable ? t('xrayInbound.enabledStatus') : t('xrayInbound.disabledStatus')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(ib)} title={t('xrayInbound.actions')} disabled={operatingIds.has(ib.id)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleEnable(ib)} title={ib.enable ? t('xrayInbound.disabledStatus') : t('xrayInbound.enabledStatus')} disabled={operatingIds.has(ib.id)}>
                            {operatingIds.has(ib.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : ib.enable ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(ib.id)} className="text-destructive" title={t('xrayInbound.actions')} disabled={operatingIds.has(ib.id)}>
                            {operatingIds.has(ib.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded client sub-table */}
                    {expandedInbound === ib.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0 bg-muted/30">
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold">{t('xrayInbound.clientList')}</h4>
                              <Button size="sm" onClick={() => handleClientCreate(ib.id)}>
                                <Plus className="mr-1 h-3 w-3" />{t('xrayInbound.addClient')}
                              </Button>
                            </div>
                            {clientsLoading[ib.id] ? (
                              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.loading')}
                              </div>
                            ) : (clients[ib.id] || []).length === 0 ? (
                              <p className="text-center py-4 text-muted-foreground text-sm">{t('xrayInbound.noClients')}</p>
                            ) : (
                              <div className="rounded border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">{t('xrayInbound.email')}</TableHead>
                                      {isAdmin && <TableHead className="text-xs">{t('xrayInbound.user')}</TableHead>}
                                      <TableHead className="text-xs">{t('xrayInbound.uuidPassword')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.flowLabel')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.uploadDownload')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.trafficLimit')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.ipLimit')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.expireTime')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.clientStatus')}</TableHead>
                                      <TableHead className="text-xs">{t('xrayInbound.actions')}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(clients[ib.id] || []).map((c: any) => {
                                      const isExpired = c.expTime && new Date(c.expTime) < new Date();
                                      const totalUsed = (c.upTraffic || c.up || 0) + (c.downTraffic || c.down || 0);
                                      const isOverTraffic = c.totalTraffic > 0 && totalUsed >= c.totalTraffic;

                                      return (
                                        <TableRow key={c.id}>
                                          <TableCell className="text-xs">{c.email || '-'}</TableCell>
                                          {isAdmin && <TableCell className="text-xs">{c.userId ? getUserName(c.userId) : '-'}</TableCell>}
                                          <TableCell className="text-xs font-mono max-w-[120px] truncate" title={c.uuidOrPassword}>
                                            {c.uuidOrPassword ? `${c.uuidOrPassword.slice(0, 8)}...` : '-'}
                                          </TableCell>
                                          <TableCell className="text-xs">{c.flow || '-'}</TableCell>
                                          <TableCell className="text-xs">
                                            {formatBytes(c.upTraffic || c.up || 0)} / {formatBytes(c.downTraffic || c.down || 0)}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {c.totalTraffic ? formatBytes(c.totalTraffic) : t('common.unlimited')}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {c.limitIp ? c.limitIp : t('common.unlimited')}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {c.expTime ? new Date(c.expTime).toLocaleDateString() : t('common.neverExpire')}
                                          </TableCell>
                                          <TableCell>
                                            {isExpired ? (
                                              <Badge variant="destructive" className="text-xs">{t('xrayInbound.expired')}</Badge>
                                            ) : isOverTraffic ? (
                                              <Badge variant="destructive" className="text-xs">{t('xrayInbound.overLimit')}</Badge>
                                            ) : c.enable === 0 ? (
                                              <Badge variant="secondary" className="text-xs">{t('xrayInbound.disabledStatus')}</Badge>
                                            ) : (
                                              <Badge variant="default" className="text-xs">{t('xrayInbound.enabledStatus')}</Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex gap-0.5">
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleClientEdit(c)} title={t('xrayInbound.actions')}>
                                                <Edit2 className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResetTraffic(c.id, ib.id)} title={t('xrayInbound.trafficReset')}>
                                                <RotateCcw className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyLink(c.id)} title={t('xrayInbound.copyLink')}>
                                                <Copy className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShowQR(c.id)} title={t('xrayInbound.qrCode')}>
                                                <QrCode className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleClientDelete(c.id, ib.id)} title={t('xrayInbound.actions')}>
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inbound Dialog */}
      <InboundDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingInbound={editingInbound}
        nodes={nodes}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrRemark || t('xrayInbound.qrCode')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <QRCodeSVG value={qrLink} size={256} />
            <div className="w-full rounded bg-muted p-2 text-xs font-mono break-all select-all max-h-24 overflow-y-auto">
              {qrLink}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(qrLink);
                toast.success(t('xrayInbound.linkCopied'));
              }}
            >
              <Copy className="mr-2 h-4 w-4" />{t('xrayInbound.copyLink')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Create/Edit Dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? t('xrayInbound.editClient') : t('xrayInbound.createClient')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('xrayInbound.userOptional')}</Label>
                  <Select value={clientForm.userId} onValueChange={v => setClientForm(p => ({ ...p, userId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('xrayInbound.selectUser')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('xrayInbound.noBind')}</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.user}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('xrayInbound.email')}</Label>
                  <Input value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="client@example.com" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('xrayInbound.uuidLabel')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setClientForm(p => ({ ...p, uuid: randomUUID() }))}>
                  <RefreshCw className="mr-1 h-3 w-3" />{t('xrayInbound.generate')}
                </Button>
              </div>
              <Input value={clientForm.uuid} onChange={e => setClientForm(p => ({ ...p, uuid: e.target.value }))} placeholder="UUID" className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {showFlowSelect ? (
                <div className="space-y-2">
                  <Label>Flow</Label>
                  <Select value={clientForm.flow || '_none'} onValueChange={v => setClientForm(p => ({ ...p, flow: v === '_none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder={t('xrayInbound.selectFlow')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('xrayInbound.none')}</SelectItem>
                      <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
                      <SelectItem value="xtls-rprx-vision-udp443">xtls-rprx-vision-udp443</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Flow</Label>
                  <Input value={clientForm.flow} onChange={e => setClientForm(p => ({ ...p, flow: e.target.value }))} placeholder="留空" />
                </div>
              )}
              {isVMessClient ? (
                <div className="space-y-2">
                  <Label>{t('xrayInbound.alterId')}</Label>
                  <Input type="number" value={clientForm.alterId} onChange={e => setClientForm(p => ({ ...p, alterId: e.target.value }))} placeholder="0" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t('xrayInbound.alterId')}</Label>
                  <Input type="number" value={clientForm.alterId} onChange={e => setClientForm(p => ({ ...p, alterId: e.target.value }))} placeholder="0" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('xrayInbound.trafficLimitGb')}</Label>
                <Input
                  type="number"
                  value={clientForm.totalTraffic}
                  onChange={e => setClientForm(p => ({ ...p, totalTraffic: e.target.value }))}
                  placeholder={t('xrayInbound.noReset')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('xrayInbound.expireTime')}</Label>
                <Input
                  type="datetime-local"
                  value={clientForm.expTime}
                  onChange={e => setClientForm(p => ({ ...p, expTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('xrayInbound.ipLimit')}</Label>
                <Input
                  type="number"
                  value={clientForm.limitIp}
                  onChange={e => setClientForm(p => ({ ...p, limitIp: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('xrayInbound.resetCycleDays')}</Label>
                <Input
                  type="number"
                  value={clientForm.reset}
                  onChange={e => setClientForm(p => ({ ...p, reset: e.target.value }))}
                  placeholder={t('xrayInbound.noReset')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('xrayInbound.remark')}</Label>
              <Input value={clientForm.remark} onChange={e => setClientForm(p => ({ ...p, remark: e.target.value }))} placeholder={t('xrayInbound.remark')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleClientSubmit}>{editingClient ? t('common.confirm') : t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
