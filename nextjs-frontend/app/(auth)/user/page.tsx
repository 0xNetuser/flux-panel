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

interface NodeItem {
  id: number;
  name: string;
  status: number;
}

export default function UserPage() {
  const { isAdmin } = useAuth();
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
      toast.error('请填写用户名和密码');
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
      toast.success(editingUser ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此用户?')) return;
    const res = await deleteUser(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const handleResetFlow = async (id: number) => {
    if (!confirm('确定重置此用户的流量?')) return;
    const res = await resetUserFlow({ id, type: 0 });
    if (res.code === 0) { toast.success('流量已重置'); loadData(); }
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
        <h2 className="text-2xl font-bold">用户管理</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建用户</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>权限</TableHead>
                <TableHead>流量 (已用/总量)</TableHead>
                <TableHead>转发数</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
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
                          {u.roleId === 0 ? '管理员' : '用户'}
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
                        {formatBytes(usedFlow)} / {u.flow ? `${u.flow} GB` : '无限'}
                      </TableCell>
                      <TableCell>{u.num || '无限'}</TableCell>
                      <TableCell className="text-sm">
                        {u.expTime ? new Date(u.expTime).toLocaleDateString() : '永不过期'}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">已过期</Badge>
                        ) : isOverFlow ? (
                          <Badge variant="destructive">流量超限</Badge>
                        ) : (
                          <Badge variant="default">正常</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(u)} title="编辑">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleResetFlow(u.id)} title="重置流量">
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
            <DialogTitle>{editingUser ? '编辑用户' : '创建用户'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={form.user}
                onChange={e => setForm(p => ({ ...p, user: e.target.value }))}
                placeholder="用户名"
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label>密码{editingUser ? ' (留空不修改)' : ''}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={editingUser ? '留空不修改' : '密码'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>流量 (GB)</Label>
                <Input
                  type="number"
                  value={form.flow}
                  onChange={e => setForm(p => ({ ...p, flow: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
              <div className="space-y-2">
                <Label>转发数量</Label>
                <Input
                  type="number"
                  value={form.num}
                  onChange={e => setForm(p => ({ ...p, num: e.target.value }))}
                  placeholder="0 = 无限"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>到期时间</Label>
              <Input
                type="datetime-local"
                value={form.expTime}
                onChange={e => setForm(p => ({ ...p, expTime: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Permission Settings */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">权限设置</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="gost-switch" className="text-sm">GOST 转发</Label>
                  <Switch
                    id="gost-switch"
                    checked={form.gostEnabled}
                    onCheckedChange={(checked: boolean) => setForm(p => ({ ...p, gostEnabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="xray-switch" className="text-sm">Xray 代理</Label>
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
                  <Label className="text-base font-semibold">节点权限</Label>
                  <Button variant="outline" size="sm" onClick={toggleAllNodes}>
                    {form.nodeIds.length === allNodeIds.length ? '取消全选' : '全选'}
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
                        {node.status === 1 ? '在线' : '离线'}
                      </Badge>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  已选 {form.nodeIds.length} / {nodes.length} 个节点。不选择任何节点表示允许访问全部节点。
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingUser ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
