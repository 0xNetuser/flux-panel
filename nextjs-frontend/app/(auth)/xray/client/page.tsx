'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, RotateCcw, Copy, RefreshCw, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import {
  createXrayClient, getXrayClientList, updateXrayClient,
  deleteXrayClient, resetXrayClientTraffic, getXrayClientLink,
} from '@/lib/api/xray-client';
import { getXrayInboundList } from '@/lib/api/xray-inbound';
import { getAllUsers } from '@/lib/api/user';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

export default function XrayClientPage() {
  const { isAdmin, xrayEnabled } = useAuth();
  const { t } = useTranslation();
  const [clients, setClients] = useState<any[]>([]);
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [qrRemark, setQrRemark] = useState('');
  const [form, setForm] = useState({
    inboundId: '', userId: '', email: '', uuid: '', flow: '',
    alterId: '0', totalTraffic: '', expTime: '', remark: '',
    limitIp: '0', reset: '0',
  });

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const promises: Promise<any>[] = [getXrayClientList(), getXrayInboundList()];
    if (isAdmin) promises.push(getAllUsers());

    const results = await Promise.all(promises);
    if (results[0].code === 0) setClients(results[0].data || []);
    if (results[1].code === 0) setInbounds(results[1].data || []);
    if (isAdmin && results[2]?.code === 0) setUsers(results[2].data || []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const getInboundTag = (inboundId: number) => {
    const ib = inbounds.find((i: any) => i.id === inboundId);
    return ib ? (ib.remark || ib.tag || `#${inboundId}`) : `#${inboundId}`;
  };

  const getInboundProtocol = (inboundId: number) => {
    const ib = inbounds.find((i: any) => i.id === inboundId);
    return ib?.protocol || '-';
  };

  const getUserName = (userId: number) => {
    const u = users.find((u: any) => u.id === userId);
    return u ? u.user : `#${userId}`;
  };

  const handleCreate = () => {
    setEditingClient(null);
    setForm({
      inboundId: '', userId: '', email: '', uuid: generateUUID(), flow: '',
      alterId: '0', totalTraffic: '', expTime: '', remark: '',
      limitIp: '0', reset: '0',
    });
    setDialogOpen(true);
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setForm({
      inboundId: client.inboundId?.toString() || '',
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
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.inboundId || !form.uuid) {
      toast.error(t('xrayClient.fillRequired'));
      return;
    }

    const data: any = {
      inboundId: parseInt(form.inboundId),
      email: form.email || undefined,
      uuidOrPassword: form.uuid || undefined,
      flow: form.flow || undefined,
      alterId: parseInt(form.alterId) || 0,
      limitIp: parseInt(form.limitIp) || 0,
      reset: parseInt(form.reset) || 0,
      remark: form.remark || undefined,
    };
    if (form.userId) data.userId = parseInt(form.userId);
    if (form.totalTraffic) data.totalTraffic = parseFloat(form.totalTraffic) * 1024 * 1024 * 1024;
    if (form.expTime) data.expTime = new Date(form.expTime).getTime();

    let res;
    if (editingClient) {
      res = await updateXrayClient({ ...data, id: editingClient.id });
    } else {
      res = await createXrayClient(data);
    }

    if (res.code === 0) {
      toast.success(editingClient ? t('common.updateSuccess') : t('common.createSuccess'));
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('xrayClient.confirmDelete'))) return;
    const res = await deleteXrayClient(id);
    if (res.code === 0) { toast.success(t('common.deleteSuccess')); loadData(); }
    else toast.error(res.msg);
  };

  const handleResetTraffic = async (id: number) => {
    if (!confirm(t('xrayClient.confirmResetTraffic'))) return;
    const res = await resetXrayClientTraffic(id);
    if (res.code === 0) { toast.success(t('xrayClient.trafficReset')); loadData(); }
    else toast.error(res.msg);
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
        <p className="text-muted-foreground">{t('xrayClient.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('xrayClient.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('xrayClient.createClient')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('xrayClient.email')}</TableHead>
                {isAdmin && <TableHead>{t('xrayClient.user')}</TableHead>}
                <TableHead>{t('xrayClient.inbound')}</TableHead>
                <TableHead>{t('xrayClient.protocol')}</TableHead>
                <TableHead>{t('xrayClient.uploadDownload')}</TableHead>
                <TableHead>{t('xrayClient.trafficLimit')}</TableHead>
                <TableHead>{t('xrayClient.ipLimit')}</TableHead>
                <TableHead>{t('xrayClient.resetCycle')}</TableHead>
                <TableHead>{t('xrayClient.expireTime')}</TableHead>
                <TableHead>{t('xrayClient.status')}</TableHead>
                <TableHead>{t('xrayClient.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : clients.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                clients.map((c) => {
                  const isExpired = c.expTime && new Date(c.expTime) < new Date();
                  const totalUsed = (c.upTraffic || c.up || 0) + (c.downTraffic || c.down || 0);
                  const isOverTraffic = c.totalTraffic > 0 && totalUsed >= c.totalTraffic;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{c.email || '-'}</TableCell>
                      {isAdmin && <TableCell className="text-sm">{c.userId ? getUserName(c.userId) : '-'}</TableCell>}
                      <TableCell className="text-sm">{getInboundTag(c.inboundId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getInboundProtocol(c.inboundId).toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatBytes(c.upTraffic || c.up || 0)} / {formatBytes(c.downTraffic || c.down || 0)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.totalTraffic ? formatBytes(c.totalTraffic) : t('common.unlimited')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.limitIp ? c.limitIp : t('common.unlimited')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.reset ? `${c.reset} ${t('xrayClient.daysUnit')}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.expTime ? new Date(c.expTime).toLocaleDateString() : t('common.neverExpire')}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">{t('xrayClient.expired')}</Badge>
                        ) : isOverTraffic ? (
                          <Badge variant="destructive">{t('xrayClient.overTraffic')}</Badge>
                        ) : c.enable === 0 ? (
                          <Badge variant="secondary">{t('common.disabled')}</Badge>
                        ) : (
                          <Badge variant="default">{t('common.enabled')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} title={t('xrayClient.actions')}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleResetTraffic(c.id)} title={t('xrayClient.trafficReset')}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleCopyLink(c.id)} title={t('xrayInbound.copyLink')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleShowQR(c.id)} title={t('xrayInbound.qrCode')}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-destructive" title={t('xrayClient.actions')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* Create/Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? t('xrayClient.editClient') : t('xrayClient.createClient')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={isAdmin ? "grid grid-cols-2 gap-4" : ""}>
              <div className="space-y-2">
                <Label>{t('xrayClient.inbound')}</Label>
                <Select value={form.inboundId} onValueChange={v => setForm(p => ({ ...p, inboundId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('xrayClient.selectInbound')} /></SelectTrigger>
                  <SelectContent>
                    {inbounds.map((ib: any) => (
                      <SelectItem key={ib.id} value={ib.id.toString()}>
                        {ib.remark || ib.tag || `#${ib.id}`} ({ib.protocol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>{t('xrayClient.userOptional')}</Label>
                  <Select value={form.userId} onValueChange={v => setForm(p => ({ ...p, userId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('xrayClient.selectUser')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('xrayClient.noBind')}</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.user}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>{t('xrayClient.email')}</Label>
                <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="client@example.com" />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('xrayClient.uuid')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(p => ({ ...p, uuid: generateUUID() }))}>
                  <RefreshCw className="mr-1 h-3 w-3" />{t('xrayClient.generate')}
                </Button>
              </div>
              <Input value={form.uuid} onChange={e => setForm(p => ({ ...p, uuid: e.target.value }))} placeholder="UUID" className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('xrayClient.flow')}</Label>
                <Input value={form.flow} onChange={e => setForm(p => ({ ...p, flow: e.target.value }))} placeholder="xtls-rprx-vision" />
              </div>
              <div className="space-y-2">
                <Label>{t('xrayClient.alterId')}</Label>
                <Input type="number" value={form.alterId} onChange={e => setForm(p => ({ ...p, alterId: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('xrayClient.trafficLimitGb')}</Label>
                <Input
                  type="number"
                  value={form.totalTraffic}
                  onChange={e => setForm(p => ({ ...p, totalTraffic: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('xrayClient.expireTime')}</Label>
                <Input
                  type="datetime-local"
                  value={form.expTime}
                  onChange={e => setForm(p => ({ ...p, expTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('xrayClient.ipLimit')}</Label>
                <Input
                  type="number"
                  value={form.limitIp}
                  onChange={e => setForm(p => ({ ...p, limitIp: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('xrayClient.resetCycleDays')}</Label>
                <Input
                  type="number"
                  value={form.reset}
                  onChange={e => setForm(p => ({ ...p, reset: e.target.value }))}
                  placeholder={t('xrayClient.noReset')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('xrayClient.remark')}</Label>
              <Input value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} placeholder={t('xrayClient.remark')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{editingClient ? t('common.confirm') : t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
