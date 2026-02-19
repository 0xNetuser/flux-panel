'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pause, Play, Edit2, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { getForwardList, createForward, updateForward, deleteForward, pauseForwardService, resumeForwardService, diagnoseForward } from '@/lib/api/forward';
import { userTunnel } from '@/lib/api/tunnel';
import { useAuth } from '@/lib/hooks/use-auth';

export default function ForwardPage() {
  const { isAdmin } = useAuth();
  const [forwards, setForwards] = useState<any[]>([]);
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForward, setEditingForward] = useState<any>(null);
  const [form, setForm] = useState({ name: '', tunnelId: '', remoteAddr: '', inPort: '', strategy: 'round', interfaceName: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [forwardRes, tunnelRes] = await Promise.all([getForwardList(), userTunnel()]);
    if (forwardRes.code === 0) setForwards(forwardRes.data || []);
    if (tunnelRes.code === 0) setTunnels(tunnelRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => {
    setEditingForward(null);
    setForm({ name: '', tunnelId: '', remoteAddr: '', inPort: '', strategy: 'round', interfaceName: '' });
    setDialogOpen(true);
  };

  const handleEdit = (forward: any) => {
    setEditingForward(forward);
    setForm({
      name: forward.name,
      tunnelId: forward.tunnelId?.toString(),
      remoteAddr: forward.remoteAddr,
      inPort: forward.inPort?.toString() || '',
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
    const res = await diagnoseForward(id);
    if (res.code === 0) {
      toast.success('诊断完成');
    } else {
      toast.error(res.msg);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : forwards.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                forwards.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.tunnelName}</TableCell>
                    <TableCell>{f.inIp}:{f.inPort}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{f.remoteAddr}</TableCell>
                    <TableCell className="text-xs">{formatBytes(f.inFlow)} / {formatBytes(f.outFlow)}</TableCell>
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
                        <Button variant="ghost" size="icon" onClick={() => handleDiagnose(f.id)}><Stethoscope className="h-4 w-4" /></Button>
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
            <div className="space-y-2">
              <Label>入口端口 (可选)</Label>
              <Input value={form.inPort} onChange={e => setForm(p => ({ ...p, inPort: e.target.value }))} placeholder="自动分配" />
            </div>
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
