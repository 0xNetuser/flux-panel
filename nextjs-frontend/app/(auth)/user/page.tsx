'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Edit2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getAllUsers, createUser, updateUser, deleteUser, resetUserFlow } from '@/lib/api/user';
import { getNodeList } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

interface NodeItem {
  id: number;
  name: string;
  status: number;
}

export default function UserPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({
    user: '',
    password: '',
    flow: '',
    num: '',
    expTime: '',
    gostEnabled: true,
    xrayEnabled: true,
    nodeIds: [] as number[],
  });

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [usersRes, nodesRes] = await Promise.all([getAllUsers(), getNodeList()]);
    if (usersRes.code === 0) setUsers(usersRes.data || []);
    if (nodesRes.code === 0) setNodes(nodesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allNodeIds = nodes.map(n => n.id);

  const handleCreate = () => {
    setEditingUser(null);
    setForm({
      user: '',
      password: '',
      flow: '',
      num: '',
      expTime: '',
      gostEnabled: true,
      xrayEnabled: true,
      nodeIds: [...allNodeIds],
    });
    setDialogOpen(true);
  };

  const handleEdit = (u: any) => {
    setEditingUser(u);
    const userNodeIds = u.nodeIds && u.nodeIds.length > 0 ? u.nodeIds : [...allNodeIds];
    setForm({
      user: u.user || '',
      password: '',
      flow: u.flow?.toString() || '',
      num: u.num?.toString() || '',
      expTime: u.expTime ? new Date(u.expTime).toISOString().slice(0, 16) : '',
      gostEnabled: u.gostEnabled !== 0,
      xrayEnabled: u.xrayEnabled !== 0,
      nodeIds: userNodeIds,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingUser && (!form.user || !form.password)) {
      toast.error(t('user.fillUsernameAndPassword'));
      return;
    }
    const data: any = {
      user: form.user,
      gostEnabled: form.gostEnabled ? 1 : 0,
      xrayEnabled: form.xrayEnabled ? 1 : 0,
      nodeIds: form.nodeIds,
    };
    if (form.password) data.pwd = form.password;
    if (form.flow) data.flow = parseFloat(form.flow);
    if (form.num) data.num = parseInt(form.num);
    if (form.expTime) data.expTime = new Date(form.expTime).getTime();

    let res;
    if (editingUser) {
      res = await updateUser({ ...data, id: editingUser.id });
    } else {
      res = await createUser(data);
    }

    if (res.code === 0) {
      toast.success(editingUser ? t('common.updateSuccess') : t('common.createSuccess'));
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('user.confirmDelete'))) return;
    const res = await deleteUser(id);
    if (res.code === 0) { toast.success(t('common.deleteSuccess')); loadData(); }
    else toast.error(res.msg);
  };

  const handleResetFlow = async (id: number) => {
    if (!confirm(t('user.confirmResetTraffic'))) return;
    const res = await resetUserFlow({ id, type: 0 });
    if (res.code === 0) { toast.success(t('user.trafficReset')); loadData(); }
    else toast.error(res.msg);
  };

  const toggleNodeId = (nodeId: number) => {
    setForm(p => ({
      ...p,
      nodeIds: p.nodeIds.includes(nodeId)
        ? p.nodeIds.filter(id => id !== nodeId)
        : [...p.nodeIds, nodeId],
    }));
  };

  const toggleAllNodes = () => {
    setForm(p => ({
      ...p,
      nodeIds: p.nodeIds.length === allNodeIds.length ? [] : [...allNodeIds],
    }));
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
        <h2 className="text-2xl font-bold">{t('user.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('user.createUser')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('user.username')}</TableHead>
                <TableHead>{t('user.role')}</TableHead>
                <TableHead>{t('user.permissions')}</TableHead>
                <TableHead>{t('user.trafficUsedTotal')}</TableHead>
                <TableHead>{t('user.forwardCount')}</TableHead>
                <TableHead>{t('user.expireTime')}</TableHead>
                <TableHead>{t('user.status')}</TableHead>
                <TableHead>{t('user.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                users.map((u) => {
                  const usedFlow = (u.inFlow || 0) + (u.outFlow || 0);
                  const totalFlow = u.flow ? u.flow * 1024 * 1024 * 1024 : 0;
                  const isExpired = u.expTime && new Date(u.expTime) < new Date();
                  const isOverFlow = totalFlow > 0 && usedFlow >= totalFlow;

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.user}</TableCell>
                      <TableCell>
                        <Badge variant={u.roleId === 0 ? 'default' : 'secondary'}>
                          {u.roleId === 0 ? t('user.admin') : t('user.normalUser')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.gostEnabled !== 0 && (
                            <Badge variant="outline" className="text-xs">GOST</Badge>
                          )}
                          {u.xrayEnabled !== 0 && (
                            <Badge variant="outline" className="text-xs">Xray</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatBytes(usedFlow)} / {u.flow ? `${u.flow} GB` : t('common.unlimited')}
                      </TableCell>
                      <TableCell>{u.num || t('common.unlimited')}</TableCell>
                      <TableCell className="text-sm">
                        {u.expTime ? new Date(u.expTime).toLocaleDateString() : t('common.neverExpire')}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">{t('user.expired')}</Badge>
                        ) : isOverFlow ? (
                          <Badge variant="destructive">{t('user.overTraffic')}</Badge>
                        ) : (
                          <Badge variant="default">{t('user.normal')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(u)} title="编辑">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleResetFlow(u.id)} title={t('user.resetTraffic')}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="text-destructive" title="删除">
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

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? t('user.editUser') : t('user.createUserTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('user.username')}</Label>
              <Input
                value={form.user}
                onChange={e => setForm(p => ({ ...p, user: e.target.value }))}
                placeholder={t('user.usernamePlaceholder')}
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? t('user.passwordHintEdit') : t('user.password')}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={editingUser ? t('user.passwordPlaceholderEdit') : t('user.passwordPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('user.trafficGb')}</Label>
                <Input
                  type="number"
                  value={form.flow}
                  onChange={e => setForm(p => ({ ...p, flow: e.target.value }))}
                  placeholder={t('user.trafficPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('user.forwardNum')}</Label>
                <Input
                  type="number"
                  value={form.num}
                  onChange={e => setForm(p => ({ ...p, num: e.target.value }))}
                  placeholder={t('user.forwardPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('user.expireTime')}</Label>
              <Input
                type="datetime-local"
                value={form.expTime}
                onChange={e => setForm(p => ({ ...p, expTime: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Permission Settings */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('user.permissionSettings')}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="gost-switch" className="text-sm">{t('user.gostForward')}</Label>
                  <Switch
                    id="gost-switch"
                    checked={form.gostEnabled}
                    onCheckedChange={(checked: boolean) => setForm(p => ({ ...p, gostEnabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="xray-switch" className="text-sm">{t('user.xrayProxy')}</Label>
                  <Switch
                    id="xray-switch"
                    checked={form.xrayEnabled}
                    onCheckedChange={(checked: boolean) => setForm(p => ({ ...p, xrayEnabled: checked }))}
                  />
                </div>
              </div>
            </div>

            {/* Node Permissions */}
            {nodes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t('user.nodePermissions')}</Label>
                  <Button variant="outline" size="sm" onClick={toggleAllNodes}>
                    {form.nodeIds.length === allNodeIds.length ? t('user.deselectAll') : t('user.selectAll')}
                  </Button>
                </div>
                <div className="max-h-[160px] overflow-y-auto rounded-lg border p-2 space-y-1">
                  {nodes.map((node) => (
                    <label
                      key={node.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={form.nodeIds.includes(node.id)}
                        onCheckedChange={() => toggleNodeId(node.id)}
                      />
                      <span className="text-sm flex-1">{node.name}</span>
                      <Badge variant={node.status === 1 ? 'default' : 'secondary'} className="text-xs">
                        {node.status === 1 ? t('common.online') : t('common.offline')}
                      </Badge>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('user.selectedNodes', { selected: form.nodeIds.length, total: nodes.length })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{editingUser ? t('common.update') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
