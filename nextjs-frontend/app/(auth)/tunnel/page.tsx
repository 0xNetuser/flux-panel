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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  getTunnelList, createTunnel, updateTunnel, deleteTunnel,
  assignUserTunnel, getUserTunnelList, removeUserTunnel,
} from '@/lib/api/tunnel';
import { getNodeList } from '@/lib/api/node';
import { getAllUsers } from '@/lib/api/user';
import { useAuth } from '@/lib/hooks/use-auth';

export default function TunnelPage() {
  const { isAdmin } = useAuth();
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', inNodeId: '', outNodeId: '', type: 'port', protocol: 'tcp+udp',
    portSta: '', portEnd: '', interfaceName: '',
  });

  // User-tunnel assignment state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [userTunnels, setUserTunnels] = useState<any[]>([]);
  const [userTunnelLoading, setUserTunnelLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({ userId: '', tunnelId: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tunnelRes, nodeRes] = await Promise.all([getTunnelList(), getNodeList()]);
      if (tunnelRes.code === 0) setTunnels(tunnelRes.data || []);
      if (nodeRes.code === 0) setNodes(nodeRes.data || []);
      if (isAdmin) {
        const userRes = await getAllUsers();
        if (userRes.code === 0) setUsers(userRes.data || []);
      }
    } catch {
      toast.error('加载数据失败');
    }
    setLoading(false);
  }, [isAdmin]);

  const loadUserTunnels = useCallback(async () => {
    setUserTunnelLoading(true);
    const res = await getUserTunnelList();
    if (res.code === 0) setUserTunnels(res.data || []);
    setUserTunnelLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (isAdmin) loadUserTunnels(); }, [isAdmin, loadUserTunnels]);

  const handleCreate = () => {
    setEditingTunnel(null);
    setForm({ name: '', inNodeId: '', outNodeId: '', type: 'port', protocol: 'tcp+udp', portSta: '', portEnd: '', interfaceName: '' });
    setDialogOpen(true);
  };

  const handleEdit = (tunnel: any) => {
    setEditingTunnel(tunnel);
    setForm({
      name: tunnel.name || '',
      inNodeId: tunnel.inNodeId?.toString() || '',
      outNodeId: tunnel.outNodeId?.toString() || '',
      type: tunnel.type === 2 ? 'tunnel' : 'port',
      protocol: tunnel.type === 2 ? (tunnel.protocol || 'tls') : 'tcp+udp',
      portSta: tunnel.portSta?.toString() || '',
      portEnd: tunnel.portEnd?.toString() || '',
      interfaceName: tunnel.interfaceName || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.inNodeId || !form.outNodeId) {
      toast.error('请填写必要字段');
      return;
    }
    const typeInt = form.type === 'tunnel' ? 2 : (typeof form.type === 'number' ? form.type : 1);
    if (typeInt === 2 && form.inNodeId === form.outNodeId) {
      toast.error('隧道转发的入口节点和出口节点不能相同');
      return;
    }
    const data: any = {
      name: form.name,
      inNodeId: parseInt(form.inNodeId),
      outNodeId: parseInt(form.outNodeId),
      type: typeInt,
      protocol: form.protocol,
      interfaceName: form.interfaceName || null,
    };
    if (form.portSta) data.portSta = parseInt(form.portSta);
    if (form.portEnd) data.portEnd = parseInt(form.portEnd);

    let res;
    if (editingTunnel) {
      res = await updateTunnel({ ...data, id: editingTunnel.id });
    } else {
      res = await createTunnel(data);
    }

    if (res.code === 0) {
      toast.success(editingTunnel ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此隧道?')) return;
    const res = await deleteTunnel(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const handleAssign = async () => {
    if (!assignForm.userId || !assignForm.tunnelId) {
      toast.error('请选择用户和隧道');
      return;
    }
    const res = await assignUserTunnel({
      userId: parseInt(assignForm.userId),
      tunnelId: parseInt(assignForm.tunnelId),
    });
    if (res.code === 0) {
      toast.success('分配成功');
      setAssignDialogOpen(false);
      setAssignForm({ userId: '', tunnelId: '' });
      loadUserTunnels();
    } else {
      toast.error(res.msg);
    }
  };

  const handleRemoveUserTunnel = async (userId: number, tunnelId: number) => {
    if (!confirm('确定移除此用户的隧道权限?')) return;
    const res = await removeUserTunnel({ userId, tunnelId });
    if (res.code === 0) { toast.success('移除成功'); loadUserTunnels(); }
    else toast.error(res.msg);
  };

  const getNodeName = (nodeId: number) => {
    const node = nodes.find((n: any) => n.id === nodeId);
    return node ? node.name : `节点#${nodeId}`;
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
        <h2 className="text-2xl font-bold">隧道管理</h2>
      </div>

      <Tabs defaultValue="tunnels">
        <TabsList>
          <TabsTrigger value="tunnels">隧道列表</TabsTrigger>
          <TabsTrigger value="assign">用户分配</TabsTrigger>
        </TabsList>

        <TabsContent value="tunnels" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建隧道</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>入口节点</TableHead>
                    <TableHead>出口节点</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>协议</TableHead>
                    <TableHead>端口范围</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">加载中...</TableCell></TableRow>
                  ) : tunnels.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
                  ) : (
                    tunnels.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{getNodeName(t.inNodeId)}</TableCell>
                        <TableCell>{getNodeName(t.outNodeId)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t.type === 1 ? '端口转发' : '隧道转发'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t.type === 1 ? 'TCP+UDP' : t.protocol?.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>{t.portSta} - {t.portEnd}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === 1 ? 'default' : 'secondary'}>
                            {t.status === 1 ? '正常' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-destructive">
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
        </TabsContent>

        <TabsContent value="assign" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAssignDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />分配隧道
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>隧道</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userTunnelLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8">加载中...</TableCell></TableRow>
                  ) : userTunnels.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">暂无分配</TableCell></TableRow>
                  ) : (
                    userTunnels.map((ut: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{ut.userName || ut.userId}</TableCell>
                        <TableCell>{ut.tunnelName || ut.tunnelId}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveUserTunnel(ut.userId, ut.tunnelId)} className="text-destructive">
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
        </TabsContent>
      </Tabs>

      {/* Create/Edit Tunnel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTunnel ? '编辑隧道' : '创建隧道'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="隧道名称" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>入口节点</Label>
                <Select value={form.inNodeId} onValueChange={v => setForm(p => ({ ...p, inNodeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择入口节点" /></SelectTrigger>
                  <SelectContent>
                    {nodes.map((n: any) => (
                      <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>出口节点</Label>
                <Select value={form.outNodeId} onValueChange={v => setForm(p => ({ ...p, outNodeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择出口节点" /></SelectTrigger>
                  <SelectContent>
                    {nodes.map((n: any) => (
                      <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v, protocol: v === 'port' ? 'tcp+udp' : 'tls' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="port">端口转发</SelectItem>
                    <SelectItem value="tunnel">隧道转发</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>协议</Label>
                {form.type === 'port' ? (
                  <Input value="TCP+UDP" disabled className="bg-muted" />
                ) : (
                  <Select value={form.protocol} onValueChange={v => setForm(p => ({ ...p, protocol: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="mtls">mTLS</SelectItem>
                      <SelectItem value="wss">WSS</SelectItem>
                      <SelectItem value="mwss">mWSS</SelectItem>
                      <SelectItem value="quic">QUIC</SelectItem>
                      <SelectItem value="grpc">gRPC</SelectItem>
                      <SelectItem value="ws">WS</SelectItem>
                      <SelectItem value="mws">mWS</SelectItem>
                      <SelectItem value="kcp">KCP</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>起始端口</Label>
                <Input value={form.portSta} onChange={e => setForm(p => ({ ...p, portSta: e.target.value }))} placeholder="10000" />
              </div>
              <div className="space-y-2">
                <Label>结束端口</Label>
                <Input value={form.portEnd} onChange={e => setForm(p => ({ ...p, portEnd: e.target.value }))} placeholder="60000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>网卡名称 (可选)</Label>
              <Input value={form.interfaceName} onChange={e => setForm(p => ({ ...p, interfaceName: e.target.value }))} placeholder="eth0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingTunnel ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User-Tunnel Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配隧道给用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户</Label>
              <Select value={assignForm.userId} onValueChange={v => setAssignForm(p => ({ ...p, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="选择用户" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>隧道</Label>
              <Select value={assignForm.tunnelId} onValueChange={v => setAssignForm(p => ({ ...p, tunnelId: v }))}>
                <SelectTrigger><SelectValue placeholder="选择隧道" /></SelectTrigger>
                <SelectContent>
                  {tunnels.map((t: any) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>取消</Button>
            <Button onClick={handleAssign}>分配</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
