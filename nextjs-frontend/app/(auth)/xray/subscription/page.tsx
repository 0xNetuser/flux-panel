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
import { useTranslation } from '@/lib/i18n';

export default function XraySubscriptionPage() {
  const { isAdmin, xrayEnabled } = useAuth();
  const { t } = useTranslation();
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
    toast.success(t('xraySub.copied', { label: label || t('common.copySuccess') }));
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
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!isAdmin && !xrayEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('xraySub.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('xraySub.title')}</h2>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />{t('xraySub.refresh')}
        </Button>
      </div>

      {/* Subscription URL Card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Rss className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{t('xraySub.subAddress')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('xraySub.subAddressDescription')}
          </p>
          {subUrl ? (
            <div className="flex gap-2">
              <Input value={subUrl} readOnly className="font-mono text-sm" />
              <Button onClick={() => copyToClipboard(subUrl, t('xraySub.subAddrCopied'))}>
                <Copy className="mr-2 h-4 w-4" />{t('xraySub.copySubAddr')}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('xraySub.noSubAddress')}</p>
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
            <CardTitle className="text-lg">{t('xraySub.protocolLinks')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('xraySub.protocolCol')}</TableHead>
                  <TableHead>{t('xraySub.nameCol')}</TableHead>
                  <TableHead>{t('xraySub.addressCol')}</TableHead>
                  <TableHead>{t('xraySub.actions')}</TableHead>
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
                          onClick={() => copyToClipboard(link.link || link.url || '', t('xraySub.copyLink'))}
                          title={t('xraySub.copyLink')}
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
            {t('xraySub.noProtocolLinks')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
