'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSpeedLimitList, createSpeedLimit, updateSpeedLimit, deleteSpeedLimit } from '@/lib/api/config';
import { getTunnelList } from '@/lib/api/tunnel';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

export default function LimitPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [limits, setLimits] = useState<any[]>([]);
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<any>(null);
  const [form, setForm] = useState({ name: '', speed: '', tunnelId: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [limitsRes, tunnelsRes] = await Promise.all([
      getSpeedLimitList(),
      getTunnelList(),
    ]);
    if (limitsRes.code === 0) setLimits(limitsRes.data || []);
    if (tunnelsRes.code === 0) setTunnels(tunnelsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => {
    setEditingLimit(null);
    setForm({ name: '', speed: '', tunnelId: '' });
    setDialogOpen(true);
  };

  const handleEdit = (limit: any) => {
    setEditingLimit(limit);
    setForm({
      name: limit.name || '',
      speed: limit.speed?.toString() || '',
      tunnelId: limit.tunnelId?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.speed) {
      toast.error(t('limit.fillNameAndSpeed'));
      return;
    }
    if (!editingLimit && !form.tunnelId) {
      toast.error(t('limit.selectTunnelRequired'));
      return;
    }
    const data: any = {
      name: form.name,
      speed: parseInt(form.speed),
    };
    if (form.tunnelId) {
      data.tunnelId = parseInt(form.tunnelId);
    }

    let res;
    if (editingLimit) {
      res = await updateSpeedLimit({ ...data, id: editingLimit.id });
    } else {
      res = await createSpeedLimit(data);
    }

    if (res.code === 0) {
      toast.success(editingLimit ? t('common.updateSuccess') : t('common.createSuccess'));
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('limit.confirmDelete'))) return;
    const res = await deleteSpeedLimit(id);
    if (res.code === 0) { toast.success(t('common.deleteSuccess')); loadData(); }
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
        <h2 className="text-2xl font-bold">{t('limit.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('limit.createRule')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('limit.name')}</TableHead>
                <TableHead>{t('limit.speedMbps')}</TableHead>
                <TableHead>{t('limit.tunnel')}</TableHead>
                <TableHead>{t('limit.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : limits.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                limits.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.speed} Mbps</TableCell>
                    <TableCell>{l.tunnelName || '-'}</TableCell>
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
            <DialogTitle>{editingLimit ? t('limit.editRule') : t('limit.createRuleTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingLimit && (
              <div className="space-y-2">
                <Label>{t('limit.tunnel')}</Label>
                <Select value={form.tunnelId} onValueChange={v => setForm(p => ({ ...p, tunnelId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('limit.selectTunnel')} /></SelectTrigger>
                  <SelectContent>
                    {tunnels.map((t: any) => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('limit.name')}</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('limit.ruleNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('limit.speedLimit')}</Label>
              <Input
                type="number"
                value={form.speed}
                onChange={e => setForm(p => ({ ...p, speed: e.target.value }))}
                placeholder={t('limit.speedPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{editingLimit ? t('common.update') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
