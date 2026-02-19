'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, RefreshCw, Rss, Link2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getSubscriptionToken, getSubscriptionLinks } from '@/lib/api/xray-subscription';
import { useAuth } from '@/lib/hooks/use-auth';

export default function XraySubscriptionPage() {
  const { username } = useAuth();
  const [token, setToken] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tokenRes, linksRes] = await Promise.all([
      getSubscriptionToken(),
      getSubscriptionLinks(),
    ]);
    if (tokenRes.code === 0 && tokenRes.data) {
      const tokenData = typeof tokenRes.data === 'string' ? tokenRes.data : tokenRes.data.token || tokenRes.data.url || '';
      setToken(tokenData);
      // Build subscription URL
      if (typeof tokenRes.data === 'object' && tokenRes.data.url) {
        setSubUrl(tokenRes.data.url);
      } else {
        const base = window.location.origin;
        setSubUrl(`${base}/api/v1/xray/sub/${tokenData}`);
      }
    }
    if (linksRes.code === 0) {
      setLinks(linksRes.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label || '内容'}已复制到剪贴板`);
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol?.toLowerCase()) {
      case 'vmess': return 'VM';
      case 'vless': return 'VL';
      case 'trojan': return 'TR';
      case 'ss':
      case 'shadowsocks': return 'SS';
      default: return '??';
    }
  };

  const getProtocolVariant = (protocol: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (protocol?.toLowerCase()) {
      case 'vmess': return 'default';
      case 'vless': return 'secondary';
      case 'trojan': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">订阅管理</h2>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />刷新
        </Button>
      </div>

      {/* Subscription URL Card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Rss className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">订阅地址</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            将以下订阅地址添加到你的代理客户端中 (如 V2rayN, Clash, Shadowrocket 等)
          </p>
          {subUrl ? (
            <div className="flex gap-2">
              <Input value={subUrl} readOnly className="font-mono text-sm" />
              <Button onClick={() => copyToClipboard(subUrl, '订阅地址')}>
                <Copy className="mr-2 h-4 w-4" />复制
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">暂无订阅地址，请联系管理员</p>
          )}
          {token && (
            <div className="text-xs text-muted-foreground">
              Token: <code className="bg-muted px-1 py-0.5 rounded">{token}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Protocol Links Card */}
      {links.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">协议链接</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>协议</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant={getProtocolVariant(link.protocol)}>
                        {getProtocolIcon(link.protocol)} {link.protocol?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{link.remark || link.name || '-'}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block">
                        {link.link || link.url || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(link.link || link.url || '', '链接')}
                          title="复制链接"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {links.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无协议链接。请确保管理员已为您分配客户端。
          </CardContent>
        </Card>
      )}
    </div>
  );
}
