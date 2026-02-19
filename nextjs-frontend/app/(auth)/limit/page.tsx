'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSpeedLimitList, createSpeedLimit, updateSpeedLimit, deleteSpeedLimit } from '@/lib/api/config';
import { useAuth } from '@/lib/hooks/use-auth';

export default function LimitPage() {
  const { isAdmin } = useAuth();
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<any>(null);
  const [form, setForm] = useState({ name: '', speed: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getSpeedLimitList();
    if (res.code === 0) setLimits(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => {
    setEditingLimit(null);
    setForm({ name: '', speed: '' });
    setDialogOpen(true);
  };

  const handleEdit = (limit: any) => {
    setEditingLimit(limit);
    setForm({
      name: limit.name || '',
      speed: limit.speed?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.speed) {
      toast.error('请填写名称和限速值');
      return;
    }
    const data: any = {
      name: form.name,
      speed: parseInt(form.speed),
    };

    let res;
    if (editingLimit) {
      res = await updateSpeedLimit({ ...data, id: editingLimit.id });
    } else {
      res = await createSpeedLimit(data);
    }

    if (res.code === 0) {
      toast.success(editingLimit ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此限速规则?')) return;
    const res = await deleteSpeedLimit(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
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
        <h2 className="text-2xl font-bold">限速规则</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建规则</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>速度 (Mbps)</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : limits.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                limits.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.speed} Mbps</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(l)} title="编辑">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)} className="text-destructive" title="删除">
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

      {/* Create/Edit Limit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLimit ? '编辑限速规则' : '创建限速规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>规则名称</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="例: 50M限速" />
            </div>
            <div className="space-y-2">
              <Label>限速 (Mbps)</Label>
              <Input
                type="number"
                value={form.speed}
                onChange={e => setForm(p => ({ ...p, speed: e.target.value }))}
                placeholder="例: 50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingLimit ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
