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
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createXrayCert, getXrayCertList, deleteXrayCert } from '@/lib/api/xray-cert';
import { getNodeList } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';

export default function XrayCertificatePage() {
  const { isAdmin } = useAuth();
  const [certs, setCerts] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nodeId: '', domain: '', publicKey: '', privateKey: '',
    autoRenew: false, expireTime: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [certRes, nodeRes] = await Promise.all([getXrayCertList(), getNodeList()]);
    if (certRes.code === 0) setCerts(certRes.data || []);
    if (nodeRes.code === 0) setNodes(nodeRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getNodeName = (nodeId: number) => {
    const node = nodes.find((n: any) => n.id === nodeId);
    return node ? node.name : `#${nodeId}`;
  };

  const handleCreate = () => {
    setForm({ nodeId: '', domain: '', publicKey: '', privateKey: '', autoRenew: false, expireTime: '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nodeId || !form.domain) {
      toast.error('请填写节点和域名');
      return;
    }

    const data: any = {
      nodeId: parseInt(form.nodeId),
      domain: form.domain,
      publicKey: form.publicKey || undefined,
      privateKey: form.privateKey || undefined,
      autoRenew: form.autoRenew,
    };
    if (form.expireTime) data.expireTime = new Date(form.expireTime).toISOString();

    const res = await createXrayCert(data);
    if (res.code === 0) {
      toast.success('创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此证书?')) return;
    const res = await deleteXrayCert(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const isExpiringSoon = (expireTime: string) => {
    if (!expireTime) return false;
    const exp = new Date(expireTime);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // 30 days
  };

  const isExpired = (expireTime: string) => {
    if (!expireTime) return false;
    return new Date(expireTime) < new Date();
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
        <h2 className="text-2xl font-bold">证书管理</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />添加证书</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>域名</TableHead>
                <TableHead>节点</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead>自动续签</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : certs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                certs.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        {cert.domain}
                      </div>
                    </TableCell>
                    <TableCell>{getNodeName(cert.nodeId)}</TableCell>
                    <TableCell className="text-sm">
                      {cert.expireTime ? new Date(cert.expireTime).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cert.autoRenew ? 'default' : 'secondary'}>
                        {cert.autoRenew ? '是' : '否'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isExpired(cert.expireTime) ? (
                        <Badge variant="destructive">已过期</Badge>
                      ) : isExpiringSoon(cert.expireTime) ? (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">即将过期</Badge>
                      ) : (
                        <Badge variant="default">有效</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cert.id)} className="text-destructive" title="删除">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Certificate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加证书</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label>域名</Label>
              <Input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} placeholder="example.com" />
            </div>
            <div className="space-y-2">
              <Label>公钥 (PEM)</Label>
              <Textarea
                value={form.publicKey}
                onChange={e => setForm(p => ({ ...p, publicKey: e.target.value }))}
                placeholder="-----BEGIN CERTIFICATE-----"
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>私钥 (PEM)</Label>
              <Textarea
                value={form.privateKey}
                onChange={e => setForm(p => ({ ...p, privateKey: e.target.value }))}
                placeholder="-----BEGIN PRIVATE KEY-----"
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>自动续签</Label>
              <Switch
                checked={form.autoRenew}
                onCheckedChange={v => setForm(p => ({ ...p, autoRenew: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label>到期时间</Label>
              <Input
                type="datetime-local"
                value={form.expireTime}
                onChange={e => setForm(p => ({ ...p, expireTime: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
