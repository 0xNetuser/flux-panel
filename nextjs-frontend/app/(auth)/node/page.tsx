'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Terminal, Container, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { getNodeList, createNode, updateNode, deleteNode, getNodeInstallCommand, getNodeDockerCommand } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';

export default function NodePage() {
  const { isAdmin } = useAuth();
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [form, setForm] = useState({ name: '', serverIp: '', portSta: '', portEnd: '', secret: '' });
  const [commandDialog, setCommandDialog] = useState(false);
  const [commandContent, setCommandContent] = useState('');
  const [commandTitle, setCommandTitle] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getNodeList();
    if (res.code === 0) setNodes(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => {
    setEditingNode(null);
    setForm({ name: '', serverIp: '', portSta: '', portEnd: '', secret: '' });
    setShowSecret(false);
    setDialogOpen(true);
  };

  const handleEdit = (node: any) => {
    setEditingNode(node);
    setForm({
      name: node.name || '',
      serverIp: node.serverIp || '',
      portSta: node.portSta?.toString() || '',
      portEnd: node.portEnd?.toString() || '',
      secret: node.secret || '',
    });
    setShowSecret(false);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.serverIp) {
      toast.error('请填写必要字段');
      return;
    }
    const data: any = {
      name: form.name,
      serverIp: form.serverIp,
      secret: form.secret || undefined,
    };
    if (form.portSta) data.portSta = parseInt(form.portSta);
    if (form.portEnd) data.portEnd = parseInt(form.portEnd);

    let res;
    if (editingNode) {
      res = await updateNode({ ...data, id: editingNode.id });
    } else {
      res = await createNode(data);
    }

    if (res.code === 0) {
      toast.success(editingNode ? '更新成功' : '创建成功');
      setDialogOpen(false);
      loadData();
    } else {
      toast.error(res.msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此节点? 相关隧道和转发将受影响。')) return;
    const res = await deleteNode(id);
    if (res.code === 0) { toast.success('删除成功'); loadData(); }
    else toast.error(res.msg);
  };

  const handleInstallCommand = async (id: number) => {
    const res = await getNodeInstallCommand(id);
    if (res.code === 0) {
      setCommandTitle('安装命令');
      setCommandContent(res.data || '');
      setCommandDialog(true);
    } else {
      toast.error(res.msg);
    }
  };

  const handleDockerCommand = async (id: number) => {
    const res = await getNodeDockerCommand(id);
    if (res.code === 0) {
      setCommandTitle('Docker 命令');
      setCommandContent(res.data || '');
      setCommandDialog(true);
    } else {
      toast.error(res.msg);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}天${hours}时${mins}分`;
    if (hours > 0) return `${hours}时${mins}分`;
    return `${mins}分`;
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
        <h2 className="text-2xl font-bold">节点管理</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />创建节点</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>端口范围</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>CPU / 内存</TableHead>
                <TableHead>运行时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : nodes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                nodes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.name}</TableCell>
                    <TableCell>{n.serverIp}</TableCell>
                    <TableCell>{n.portSta} - {n.portEnd}</TableCell>
                    <TableCell>
                      <Badge variant={n.status === 1 ? 'default' : 'destructive'}>
                        {n.status === 1 ? '在线' : '离线'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{n.version || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {n.cpuUsage != null ? `${n.cpuUsage.toFixed(1)}%` : '-'} / {n.memUsage != null ? `${n.memUsage.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{formatUptime(n.uptime)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(n)} title="编辑">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleInstallCommand(n.id)} title="安装命令">
                          <Terminal className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDockerCommand(n.id)} title="Docker命令">
                          <Container className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)} className="text-destructive" title="删除">
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

      {/* Create/Edit Node Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNode ? '编辑节点' : '创建节点'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="节点名称" />
            </div>
            <div className="space-y-2">
              <Label>服务器IP</Label>
              <Input value={form.serverIp} onChange={e => setForm(p => ({ ...p, serverIp: e.target.value }))} placeholder="1.2.3.4" />
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
              <Label>通信密钥</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={form.secret}
                  onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
                  placeholder="留空自动生成"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingNode ? '更新' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Command Dialog */}
      <Dialog open={commandDialog} onOpenChange={setCommandDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{commandTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto whitespace-pre-wrap break-all">
              {commandContent}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(commandContent)}
            >
              <Copy className="mr-2 h-3 w-3" />复制
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommandDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
