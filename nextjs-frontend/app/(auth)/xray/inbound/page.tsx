'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import {
  createXrayInbound, getXrayInboundList, updateXrayInbound,
  deleteXrayInbound, enableXrayInbound, disableXrayInbound,
} from '@/lib/api/xray-inbound';
import { getNodeList } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';

export default function XrayInboundPage() {
  const { isAdmin } = useAuth();
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInbound, setEditingInbound] = useState<any>(null);
  const [form, setForm] = useState({
    nodeId: '', protocol: 'vmess', tag: '', port: '', listen: '0.0.0.0',
    settingsJson: '{}', streamSettingsJson: '{}', sniffingJson: '{}', remark: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [inboundRes, nodeRes] = await Promise.all([getXrayInboundList(), getNodeList()]);
    if (inboundRes.code === 0) setInbounds(inboundRes.data || []);
    if (nodeRes.code === 0) setNodes(nodeRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getNodeName = (nodeId: number) => {
    const node = nodes.find((n: any) => n.id === nodeId);
    return node ? node.name : `#${nodeId}`;
  };

  const getProtocolBadgeVariant = (protocol: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (protocol?.toLowerCase()) {
      case 'vmess': return 'default';
      case 'vless': return 'secondary';
      case 'trojan': return 'destructive';
      case 'shadowsocks':
      case 'ss': return 'outline';
      default: return 'secondary';
    }
  };

  const handleCreate = () => {
    setEditingInbound(null);
    setForm({
      nodeId: '', protocol: 'vmess', tag: '', port: '', listen: '0.0.0.0',
      settingsJson: '{}', streamSettingsJson: '{}', sniffingJson: '{}', remark: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (inbound: any) => {
    setEditingInbound(inbound);
    setForm({
      nodeId: inbound.nodeId?.toString() || '',
      protocol: inbound.protocol || 'vmess',
      tag: inbound.tag || '',
      port: inbound.port?.toString() || '',
      listen: inbound.listen || '0.0.0.0',
      settingsJson: inbound.settingsJson || inbound.settings || '{}',
      streamSettingsJson: inbound.streamSettingsJson || inbound.streamSettings || '{}',
      sniffingJson: inbound.sniffingJson || inbound.sniffing || '{}',
      remark: inbound.remark || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nodeId || !form.protocol || !form.port) {
      toast.error('请填写节点、协议和端口');
      return;
    }

    // Validate JSON fields
    try {
      JSON.parse(form.settingsJson);
      JSON.parse(form.streamSettingsJson);
      JSON.parse(form.sniffingJson);
    } catch {
      toast.error('JSON 格式不正确');
      return;
    }

    const data: any = {
      nodeId: parseInt(form.nodeId),
      protocol: form.protocol,
      tag: form.tag || undefined,
      port: parseInt(form.port),
      listen: form.listen,
      settingsJson: form.settingsJson,
      streamSettingsJson: form.streamSettingsJson,
      sniffingJson: form.sniffingJson,
      remark: form.remark || undefined,
    };

    let res;
    if (editingInbound) {
      res = await updateXrayInbound({ ...data, id: editingInbound.id });
    } else {
      res = await createXrayInbound(data);
    }

    if (res.code === 0) {
      toast.success(editingInbound ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此入站? 相关客户端也将被删除。')) return;
    const res = await deleteXrayInbound(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const handleToggleEnable = async (inbound: any) => {
    const res = inbound.enable
      ? await disableXrayInbound(inbound.id)
      : await enableXrayInbound(inbound.id);
    if (res.code === 0) {
      toast.success(inbound.enable ? '已禁用' : '已启用');
      loadData();
    } else {
      toast.error(res.msg);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">入站管理</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建入站</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>备注</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>监听地址</TableHead>
                <TableHead>节点</TableHead>
                <TableHead>客户端数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : inbounds.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                inbounds.map((ib) => (
                  <TableRow key={ib.id}>
                    <TableCell className="font-medium">{ib.remark || ib.tag || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getProtocolBadgeVariant(ib.protocol)}>
                        {ib.protocol?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{ib.listen || '0.0.0.0'}:{ib.port}</TableCell>
                    <TableCell>{getNodeName(ib.nodeId)}</TableCell>
                    <TableCell>{ib.clientCount ?? ib.clients ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={ib.enable ? 'default' : 'secondary'}>
                        {ib.enable ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(ib)} title="编辑">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleEnable(ib)} title={ib.enable ? '禁用' : '启用'}>
                          {ib.enable ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(ib.id)} className="text-destructive" title="删除">
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

      {/* Create/Edit Inbound Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInbound ? '编辑入站' : '创建入站'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>节点</Label>
                <Select value={form.nodeId} onValueChange={v => setForm(p => ({ ...p, nodeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择节点" /></SelectTrigger>
                  <SelectContent>
                    {nodes.map((n: any) => (
                      <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>协议</Label>
                <Select value={form.protocol} onValueChange={v => setForm(p => ({ ...p, protocol: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vmess">VMess</SelectItem>
                    <SelectItem value="vless">VLESS</SelectItem>
                    <SelectItem value="trojan">Trojan</SelectItem>
                    <SelectItem value="shadowsocks">Shadowsocks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))} placeholder="入站标签" />
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} placeholder="443" />
              </div>
              <div className="space-y-2">
                <Label>监听地址</Label>
                <Input value={form.listen} onChange={e => setForm(p => ({ ...p, listen: e.target.value }))} placeholder="0.0.0.0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} placeholder="入站备注" />
            </div>
            <div className="space-y-2">
              <Label>Settings JSON</Label>
              <Textarea
                value={form.settingsJson}
                onChange={e => setForm(p => ({ ...p, settingsJson: e.target.value }))}
                placeholder='{"clients": []}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Stream Settings JSON</Label>
              <Textarea
                value={form.streamSettingsJson}
                onChange={e => setForm(p => ({ ...p, streamSettingsJson: e.target.value }))}
                placeholder='{"network": "tcp"}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Sniffing JSON</Label>
              <Textarea
                value={form.sniffingJson}
                onChange={e => setForm(p => ({ ...p, sniffingJson: e.target.value }))}
                placeholder='{"enabled": true, "destOverride": ["http", "tls"]}'
                rows={3}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingInbound ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
