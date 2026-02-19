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

export default function XrayClientPage() {
  const { isAdmin, xrayEnabled } = useAuth();
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
    limitIp: '0', reset: '0', tgId: '', subId: '',
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

  const generateSubId = () => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
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
      limitIp: '0', reset: '0', tgId: '', subId: '',
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
      tgId: client.tgId || '',
      subId: client.subId || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.inboundId || !form.uuid) {
      toast.error('请填写入站和UUID');
      return;
    }

    const data: any = {
      inboundId: parseInt(form.inboundId),
      uuidOrPassword: form.uuid || undefined,
      flow: form.flow || undefined,
      alterId: parseInt(form.alterId) || 0,
      limitIp: parseInt(form.limitIp) || 0,
      reset: parseInt(form.reset) || 0,
      tgId: form.tgId || undefined,
      subId: form.subId || undefined,
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
      toast.success(editingClient ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此客户端?')) return;
    const res = await deleteXrayClient(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const handleResetTraffic = async (id: number) => {
    if (!confirm('确定重置此客户端的流量?')) return;
    const res = await resetXrayClientTraffic(id);
    if (res.code === 0) { toast.success('流量已重置'); loadData(); }
    else toast.error(res.msg);
  };

  const handleCopyLink = async (id: number) => {
    try {
      const res = await getXrayClientLink(id);
      if (res.code === 0 && res.data?.link) {
        await navigator.clipboard.writeText(res.data.link);
        toast.success('链接已复制到剪贴板');
      } else {
        toast.error(res.msg || '无可用链接');
      }
    } catch {
      toast.error('获取链接失败');
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
        toast.error(res.msg || '无可用链接');
      }
    } catch {
      toast.error('获取链接失败');
    }
  };

  if (!isAdmin && !xrayEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">客户端管理</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建客户端</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                {isAdmin && <TableHead>用户</TableHead>}
                <TableHead>入站</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>上传/下载</TableHead>
                <TableHead>流量限制</TableHead>
                <TableHead>IP 限制</TableHead>
                <TableHead>重置周期</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : clients.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
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
                        {c.totalTraffic ? formatBytes(c.totalTraffic) : '无限'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.limitIp ? c.limitIp : '无限'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.reset ? `${c.reset} 天` : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.expTime ? new Date(c.expTime).toLocaleDateString() : '永不'}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">已过期</Badge>
                        ) : isOverTraffic ? (
                          <Badge variant="destructive">流量超限</Badge>
                        ) : c.enable === 0 ? (
                          <Badge variant="secondary">禁用</Badge>
                        ) : (
                          <Badge variant="default">启用</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} title="编辑">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleResetTraffic(c.id)} title="重置流量">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleCopyLink(c.id)} title="复制链接">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleShowQR(c.id)} title="二维码">
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-destructive" title="删除">
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
            <DialogTitle>{qrRemark || '二维码'}</DialogTitle>
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
                toast.success('链接已复制到剪贴板');
              }}
            >
              <Copy className="mr-2 h-4 w-4" />复制链接
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? '编辑客户端' : '创建客户端'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={isAdmin ? "grid grid-cols-2 gap-4" : ""}>
              <div className="space-y-2">
                <Label>入站</Label>
                <Select value={form.inboundId} onValueChange={v => setForm(p => ({ ...p, inboundId: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择入站" /></SelectTrigger>
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
                  <Label>用户 (可选)</Label>
                  <Select value={form.userId} onValueChange={v => setForm(p => ({ ...p, userId: v }))}>
                    <SelectTrigger><SelectValue placeholder="选择用户" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">不绑定</SelectItem>
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
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="client@example.com" />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>UUID</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(p => ({ ...p, uuid: generateUUID() }))}>
                  <RefreshCw className="mr-1 h-3 w-3" />生成
                </Button>
              </div>
              <Input value={form.uuid} onChange={e => setForm(p => ({ ...p, uuid: e.target.value }))} placeholder="UUID" className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Flow</Label>
                <Input value={form.flow} onChange={e => setForm(p => ({ ...p, flow: e.target.value }))} placeholder="xtls-rprx-vision" />
              </div>
              <div className="space-y-2">
                <Label>AlterID</Label>
                <Input type="number" value={form.alterId} onChange={e => setForm(p => ({ ...p, alterId: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>流量限制 (GB)</Label>
                <Input
                  type="number"
                  value={form.totalTraffic}
                  onChange={e => setForm(p => ({ ...p, totalTraffic: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
              <div className="space-y-2">
                <Label>到期时间</Label>
                <Input
                  type="datetime-local"
                  value={form.expTime}
                  onChange={e => setForm(p => ({ ...p, expTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IP 限制</Label>
                <Input
                  type="number"
                  value={form.limitIp}
                  onChange={e => setForm(p => ({ ...p, limitIp: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
              <div className="space-y-2">
                <Label>流量重置周期 (天)</Label>
                <Input
                  type="number"
                  value={form.reset}
                  onChange={e => setForm(p => ({ ...p, reset: e.target.value }))}
                  placeholder="0 = 不重置"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telegram ID</Label>
                <Input value={form.tgId} onChange={e => setForm(p => ({ ...p, tgId: e.target.value }))} placeholder="可选" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>订阅 ID</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(p => ({ ...p, subId: generateSubId() }))}>
                    <RefreshCw className="mr-1 h-3 w-3" />生成
                  </Button>
                </div>
                <Input value={form.subId} onChange={e => setForm(p => ({ ...p, subId: e.target.value }))} placeholder="自动生成" className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} placeholder="备注" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingClient ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
