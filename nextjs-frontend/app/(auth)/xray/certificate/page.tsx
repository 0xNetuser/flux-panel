'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createXrayCert, getXrayCertList, deleteXrayCert, issueXrayCert, renewXrayCert } from '@/lib/api/xray-cert';
import { getAccessibleNodeList } from '@/lib/api/node';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

export default function XrayCertificatePage() {
  const { isAdmin, xrayEnabled } = useAuth();
  const { t } = useTranslation();
  const [certs, setCerts] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renewingId, setRenewingId] = useState<number | null>(null);
  const [issuingId, setIssuingId] = useState<number | null>(null);
  const [certMode, setCertMode] = useState<'manual' | 'acme'>('manual');
  const [form, setForm] = useState({
    nodeId: '', domain: '', publicKey: '', privateKey: '',
    autoRenew: false, expireTime: '',
    // ACME fields
    acmeEmail: '', challengeType: 'dns01', dnsProvider: 'cloudflare', dnsApiToken: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [certRes, nodeRes] = await Promise.all([getXrayCertList(), getAccessibleNodeList()]);
    if (certRes.code === 0) setCerts(certRes.data || []);
    if (nodeRes.code === 0) setNodes(nodeRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getNodeName = (nodeId: number) => {
    const node = nodes.find((n: any) => n.id === nodeId);
    return node ? node.name : `#${nodeId}`;
  };

  const handleCreate = () => {
    setForm({
      nodeId: '', domain: '', publicKey: '', privateKey: '',
      autoRenew: false, expireTime: '',
      acmeEmail: '', challengeType: 'dns01', dnsProvider: 'cloudflare', dnsApiToken: '',
    });
    setCertMode('manual');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nodeId || !form.domain) {
      toast.error(t('xrayCert.fillNodeAndDomain'));
      return;
    }

    if (certMode === 'acme') {
      if (!form.acmeEmail) {
        toast.error(t('xrayCert.fillAcmeEmail'));
        return;
      }
      if (form.challengeType === 'dns01' && !form.dnsApiToken) {
        toast.error(t('xrayCert.fillDnsApiToken'));
        return;
      }

      const data: any = {
        nodeId: parseInt(form.nodeId),
        domain: form.domain,
        acmeEnabled: 1,
        acmeEmail: form.acmeEmail,
        challengeType: form.challengeType,
        dnsProvider: form.dnsProvider,
        dnsConfig: JSON.stringify({ apiToken: form.dnsApiToken }),
        autoRenew: 1,
      };

      const createRes = await createXrayCert(data);
      if (createRes.code !== 0) {
        toast.error(createRes.msg);
        return;
      }

      // Issue the certificate immediately
      const certId = createRes.data?.id;
      if (certId) {
        toast.info(t('xrayCert.issuingCert'));
        const issueRes = await issueXrayCert(certId);
        if (issueRes.code === 0) {
          toast.success(t('xrayCert.issueSuccess'));
        } else {
          toast.error('证书创建成功，但申请失败: ' + issueRes.msg);
        }
      }

      setDialogOpen(false);
      loadData();
    } else {
      // Manual mode
      const data: any = {
        nodeId: parseInt(form.nodeId),
        domain: form.domain,
        publicKey: form.publicKey || undefined,
        privateKey: form.privateKey || undefined,
        autoRenew: form.autoRenew ? 1 : 0,
      };
      if (form.expireTime) data.expireTime = new Date(form.expireTime).getTime();

      const res = await createXrayCert(data);
      if (res.code === 0) {
        toast.success(t('common.create'));
        setDialogOpen(false);
        loadData();
      } else {
        toast.error(res.msg);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('xrayCert.confirmDelete'))) return;
    const res = await deleteXrayCert(id);
    if (res.code === 0) { toast.success(t('common.deleteSuccess')); loadData(); }
    else toast.error(res.msg);
  };

  const handleRenew = async (id: number) => {
    setRenewingId(id);
    const res = await renewXrayCert(id);
    if (res.code === 0) {
      toast.success(t('xrayCert.renewSuccess'));
      loadData();
    } else {
      toast.error(res.msg);
    }
    setRenewingId(null);
  };

  const handleIssue = async (id: number) => {
    setIssuingId(id);
    const res = await issueXrayCert(id);
    if (res.code === 0) {
      toast.success(t('xrayCert.issueSuccess'));
      loadData();
    } else {
      toast.error(res.msg);
    }
    setIssuingId(null);
  };

  const isExpiringSoon = (expireTime: number) => {
    if (!expireTime) return false;
    const diff = expireTime - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  const isExpired = (expireTime: number) => {
    if (!expireTime) return false;
    return expireTime < Date.now();
  };

  if (!isAdmin && !xrayEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('xrayCert.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('xrayCert.title')}</h2>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />{t('xrayCert.addCert')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('xrayCert.domain')}</TableHead>
                <TableHead>{t('xrayCert.node')}</TableHead>
                <TableHead>{t('xrayCert.source')}</TableHead>
                <TableHead>{t('xrayCert.expireTime')}</TableHead>
                <TableHead>{t('xrayCert.lastRenew')}</TableHead>
                <TableHead>{t('xrayCert.autoRenew')}</TableHead>
                <TableHead>{t('xrayCert.status')}</TableHead>
                <TableHead>{t('xrayCert.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
              ) : certs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('common.noData')}</TableCell></TableRow>
              ) : (
                certs.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        {cert.domain}
                      </div>
                    </TableCell>
                    <TableCell>{getNodeName(cert.nodeId)}</TableCell>
                    <TableCell>
                      <Badge variant={cert.acmeEnabled ? 'default' : 'outline'}>
                        {cert.acmeEnabled ? 'ACME' : t('xrayCert.manual')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {cert.expireTime ? new Date(cert.expireTime).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {cert.lastRenewTime ? new Date(cert.lastRenewTime).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cert.autoRenew ? 'default' : 'secondary'}>
                        {cert.autoRenew ? t('common.yes') : t('common.no')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {isExpired(cert.expireTime) ? (
                          <Badge variant="destructive">{t('xrayCert.expired')}</Badge>
                        ) : isExpiringSoon(cert.expireTime) ? (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">{t('xrayCert.expiringSoon')}</Badge>
                        ) : cert.expireTime ? (
                          <Badge variant="default">{t('xrayCert.valid')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('xrayCert.notIssued')}</Badge>
                        )}
                        {cert.renewError && (
                          <span className="text-xs text-destructive truncate max-w-32" title={cert.renewError}>
                            {cert.renewError}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {cert.acmeEnabled === 1 && !cert.expireTime && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleIssue(cert.id)}
                            disabled={issuingId === cert.id}
                            title={t('xrayCert.issueCert')}
                          >
                            {issuingId === cert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          </Button>
                        )}
                        {cert.acmeEnabled === 1 && cert.expireTime && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRenew(cert.id)}
                            disabled={renewingId === cert.id}
                            title={t('xrayCert.renewCert')}
                          >
                            {renewingId === cert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cert.id)} className="text-destructive" title={t('xrayCert.actions')}>
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

      {/* Create Certificate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('xrayCert.addCert')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('xrayCert.node')}</Label>
              <Select value={form.nodeId} onValueChange={v => setForm(p => ({ ...p, nodeId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('xrayCert.selectNode')} /></SelectTrigger>
                <SelectContent>
                  {nodes.map((n: any) => (
                    <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('xrayCert.domain')}</Label>
              <Input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} placeholder="example.com" />
            </div>

            <Tabs value={certMode} onValueChange={v => setCertMode(v as 'manual' | 'acme')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">{t('xrayCert.manualUpload')}</TabsTrigger>
                <TabsTrigger value="acme">{t('xrayCert.acmeAuto')}</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t('xrayCert.publicKeyPem')}</Label>
                  <Textarea
                    value={form.publicKey}
                    onChange={e => setForm(p => ({ ...p, publicKey: e.target.value }))}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('xrayCert.privateKeyPem')}</Label>
                  <Textarea
                    value={form.privateKey}
                    onChange={e => setForm(p => ({ ...p, privateKey: e.target.value }))}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t('xrayCert.autoRenew')}</Label>
                  <Switch
                    checked={form.autoRenew}
                    onCheckedChange={v => setForm(p => ({ ...p, autoRenew: v }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('xrayCert.expireTime')}</Label>
                  <Input
                    type="datetime-local"
                    value={form.expireTime}
                    onChange={e => setForm(p => ({ ...p, expireTime: e.target.value }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="acme" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t('xrayCert.email')}</Label>
                  <Input
                    value={form.acmeEmail}
                    onChange={e => setForm(p => ({ ...p, acmeEmail: e.target.value }))}
                    placeholder="admin@example.com"
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('xrayCert.challengeType')}</Label>
                  <Select value={form.challengeType} onValueChange={v => setForm(p => ({ ...p, challengeType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dns01">DNS-01</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.challengeType === 'dns01' && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('xrayCert.dnsProvider')}</Label>
                      <Select value={form.dnsProvider} onValueChange={v => setForm(p => ({ ...p, dnsProvider: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cloudflare">Cloudflare</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('xrayCert.apiToken')}</Label>
                      <Input
                        type="password"
                        value={form.dnsApiToken}
                        onChange={e => setForm(p => ({ ...p, dnsApiToken: e.target.value }))}
                        placeholder="Cloudflare API Token"
                      />
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('xrayCert.acmeDescription')}
                </p>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
