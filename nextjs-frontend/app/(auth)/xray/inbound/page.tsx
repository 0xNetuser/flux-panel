'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit2, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import {
  createXrayInbound, getXrayInboundList, updateXrayInbound,
  deleteXrayInbound, enableXrayInbound, disableXrayInbound,
} from '@/lib/api/xray-inbound';
import { getAccessibleNodeList } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';
import InboundDialog from './_components/inbound-dialog';

export default function XrayInboundPage() {
  const { isAdmin, xrayEnabled } = useAuth();
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInbound, setEditingInbound] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [inboundRes, nodeRes] = await Promise.all([getXrayInboundList(), getAccessibleNodeList()]);
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

  const getTransportInfo = (ib: any) => {
    try {
      const stream = JSON.parse(ib.streamSettingsJson || ib.streamSettings || '{}');
      const network = stream.network || 'tcp';
      const security = stream.security || 'none';
      return `${network}${security !== 'none' ? '+' + security : ''}`;
    } catch {
      return '-';
    }
  };

  const handleCreate = () => {
    setEditingInbound(null);
    setDialogOpen(true);
  };

  const handleEdit = (inbound: any) => {
    setEditingInbound(inbound);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    let res;
    if (data.id) {
      res = await updateXrayInbound(data);
    } else {
      res = await createXrayInbound(data);
    }

    if (res.code === 0) {
      toast.success(data.id ? '更新成功' : '创建成功');
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
                <TableHead>传输/安全</TableHead>
                <TableHead>监听地址</TableHead>
                <TableHead>节点</TableHead>
                <TableHead>客户端数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : inbounds.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>
              ) : (
                inbounds.map((ib) => (
                  <TableRow key={ib.id}>
                    <TableCell className="font-medium">{ib.remark || ib.tag || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getProtocolBadgeVariant(ib.protocol)}>
                        {ib.protocol?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{getTransportInfo(ib)}</TableCell>
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

      <InboundDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingInbound={editingInbound}
        nodes={nodes}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
