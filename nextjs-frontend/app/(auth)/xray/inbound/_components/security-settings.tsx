'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, RefreshCw, Shuffle } from 'lucide-react';
import { genXrayKey } from '@/lib/api/xray-inbound';
import { toast } from 'sonner';
import { randomShortIds, randomRealityTarget } from '@/lib/utils/random';

// ── Types ──

export interface TlsCertItem {
  useFile: boolean;
  certFile?: string;
  keyFile?: string;
  cert?: string;
  key?: string;
  oneTimeLoading?: boolean;
  usage?: string; // encipherment | verify | issue
  buildChain?: boolean;
}

export interface SecurityForm {
  security: string;
  // TLS
  tlsServerName?: string;
  tlsMinVersion?: string;
  tlsMaxVersion?: string;
  tlsAlpn?: string[];
  tlsFingerprint?: string;
  tlsRejectUnknownSni?: boolean;
  tlsAllowInsecure?: boolean;
  tlsCipherSuites?: string;
  tlsDisableSystemRoot?: boolean;
  tlsSessionResumption?: boolean;
  tlsCerts?: TlsCertItem[];
  // Reality
  realityDest?: string;
  realityServerNames?: string;
  realityPrivateKey?: string;
  realityPublicKey?: string;
  realityShortIds?: string;
  realitySpiderX?: string;
  realityFingerprint?: string;
  realityXver?: number;
  realityShow?: boolean;
  realityMaxTimediff?: number;
  realityMinClientVer?: string;
  realityMaxClientVer?: string;
}

interface Props {
  value: SecurityForm;
  onChange: (v: SecurityForm) => void;
}

const FINGERPRINTS = [
  'chrome', 'firefox', 'safari', 'ios', 'android',
  'edge', '360', 'qq', 'random', 'randomized', 'randomizednoalpn', 'unsafe',
];

const ALPN_OPTIONS = ['h3', 'h2', 'http/1.1'];

const CIPHER_SUITES = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
  'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
  'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
  'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
  'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
  'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
];

// ── TLS Certificate Editor ──

function CertificateEditor({ certs, onChange }: { certs: TlsCertItem[]; onChange: (c: TlsCertItem[]) => void }) {
  const addCert = () => {
    onChange([...certs, { useFile: true, certFile: '', keyFile: '', usage: 'encipherment' }]);
  };

  const removeCert = (index: number) => {
    onChange(certs.filter((_, i) => i !== index));
  };

  const updateCert = (index: number, patch: Partial<TlsCertItem>) => {
    const next = [...certs];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">证书</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addCert}>
          <Plus className="h-3 w-3 mr-1" />添加证书
        </Button>
      </div>
      {certs.length === 0 && (
        <p className="text-xs text-muted-foreground">未配置证书</p>
      )}
      {certs.map((cert, i) => (
        <div key={i} className="space-y-2 p-3 border rounded-md relative">
          <Button
            type="button" variant="ghost" size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => removeCert(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                checked={cert.useFile}
                onChange={() => updateCert(i, { useFile: true })}
                className="accent-primary"
              />
              文件路径
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                checked={!cert.useFile}
                onChange={() => updateCert(i, { useFile: false })}
                className="accent-primary"
              />
              内容
            </label>
          </div>
          {cert.useFile ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Certificate File</Label>
                <Input className="text-xs h-8" value={cert.certFile ?? ''} onChange={e => updateCert(i, { certFile: e.target.value })} placeholder="/path/to/cert.pem" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Key File</Label>
                <Input className="text-xs h-8" value={cert.keyFile ?? ''} onChange={e => updateCert(i, { keyFile: e.target.value })} placeholder="/path/to/key.pem" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Certificate</Label>
                <textarea className="w-full rounded-md border bg-background px-2 py-1 text-xs font-mono min-h-[60px] resize-y" value={cert.cert ?? ''} onChange={e => updateCert(i, { cert: e.target.value })} placeholder="PEM content" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <textarea className="w-full rounded-md border bg-background px-2 py-1 text-xs font-mono min-h-[60px] resize-y" value={cert.key ?? ''} onChange={e => updateCert(i, { key: e.target.value })} placeholder="PEM content" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Usage</Label>
              <Select value={cert.usage ?? 'encipherment'} onValueChange={v => updateCert(i, { usage: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="encipherment">encipherment</SelectItem>
                  <SelectItem value="verify">verify</SelectItem>
                  <SelectItem value="issue">issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1 text-xs pb-2">
                <Checkbox checked={cert.oneTimeLoading ?? false} onCheckedChange={v => updateCert(i, { oneTimeLoading: !!v })} />
                One-Time Loading
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1 text-xs pb-2">
                <Checkbox checked={cert.buildChain ?? false} onCheckedChange={v => updateCert(i, { buildChain: !!v })} />
                Build Chain
              </label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Component ──

export default function SecuritySettings({ value, onChange }: Props) {
  const update = (patch: Partial<SecurityForm>) => onChange({ ...value, ...patch });

  const generateX25519 = async () => {
    const res = await genXrayKey();
    if (res.code === 0 && res.data) {
      update({
        realityPrivateKey: res.data.privateKey,
        realityPublicKey: res.data.publicKey,
      });
    } else {
      toast.error(res.msg || '生成密钥对失败');
    }
  };

  const generateShortIds = () => {
    update({ realityShortIds: randomShortIds() });
  };

  const generateRandomTarget = () => {
    const { dest, serverNames } = randomRealityTarget();
    update({ realityDest: dest, realityServerNames: serverNames });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Security (安全层)</Label>
        <Select value={value.security} onValueChange={v => update({ security: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="tls">TLS</SelectItem>
            <SelectItem value="reality">Reality</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TLS */}
      {value.security === 'tls' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Server Name</Label>
            <Input value={value.tlsServerName ?? ''} onChange={e => update({ tlsServerName: e.target.value })} placeholder="example.com" className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Min Version</Label>
              <Select value={value.tlsMinVersion ?? '1.2'} onValueChange={v => update({ tlsMinVersion: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.0">1.0</SelectItem>
                  <SelectItem value="1.1">1.1</SelectItem>
                  <SelectItem value="1.2">1.2</SelectItem>
                  <SelectItem value="1.3">1.3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Version</Label>
              <Select value={value.tlsMaxVersion ?? '1.3'} onValueChange={v => update({ tlsMaxVersion: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.0">1.0</SelectItem>
                  <SelectItem value="1.1">1.1</SelectItem>
                  <SelectItem value="1.2">1.2</SelectItem>
                  <SelectItem value="1.3">1.3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">ALPN</Label>
            <div className="flex gap-4">
              {ALPN_OPTIONS.map(alpn => (
                <label key={alpn} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={(value.tlsAlpn || ['h2', 'http/1.1']).includes(alpn)}
                    onCheckedChange={checked => {
                      const current = value.tlsAlpn || ['h2', 'http/1.1'];
                      const next = checked ? [...current, alpn] : current.filter(a => a !== alpn);
                      update({ tlsAlpn: next });
                    }}
                  />
                  {alpn}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Fingerprint</Label>
            <Select value={value.tlsFingerprint ?? 'chrome'} onValueChange={v => update({ tlsFingerprint: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINGERPRINTS.map(fp => (
                  <SelectItem key={fp} value={fp}>{fp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cipher Suites (可选)</Label>
            <Input
              value={value.tlsCipherSuites ?? ''}
              onChange={e => update({ tlsCipherSuites: e.target.value })}
              placeholder="留空使用默认"
              className="text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              可选值: {CIPHER_SUITES.slice(0, 3).join(', ')}...
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Reject Unknown SNI</Label>
            <Switch checked={value.tlsRejectUnknownSni ?? false} onCheckedChange={v => update({ tlsRejectUnknownSni: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Allow Insecure</Label>
            <Switch checked={value.tlsAllowInsecure ?? false} onCheckedChange={v => update({ tlsAllowInsecure: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Disable System Root</Label>
            <Switch checked={value.tlsDisableSystemRoot ?? false} onCheckedChange={v => update({ tlsDisableSystemRoot: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Session Resumption</Label>
            <Switch checked={value.tlsSessionResumption ?? false} onCheckedChange={v => update({ tlsSessionResumption: v })} />
          </div>
          {/* Certificates */}
          <CertificateEditor
            certs={value.tlsCerts || []}
            onChange={c => update({ tlsCerts: c })}
          />
        </div>
      )}

      {/* Reality */}
      {value.security === 'reality' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Dest (目标)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={generateRandomTarget}>
                <Shuffle className="h-3 w-3 mr-1" />随机目标
              </Button>
            </div>
            <Input value={value.realityDest ?? ''} onChange={e => update({ realityDest: e.target.value })} placeholder="www.example.com:443" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Server Names (逗号分隔)</Label>
            <Input value={value.realityServerNames ?? ''} onChange={e => update({ realityServerNames: e.target.value })} placeholder="www.example.com,example.com" className="text-sm" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Private Key</Label>
              <Button type="button" variant="ghost" size="sm" onClick={generateX25519}>
                <RefreshCw className="h-3 w-3 mr-1" />生成密钥对
              </Button>
            </div>
            <Input value={value.realityPrivateKey ?? ''} onChange={e => update({ realityPrivateKey: e.target.value })} placeholder="私钥" className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Public Key</Label>
            <Input value={value.realityPublicKey ?? ''} onChange={e => update({ realityPublicKey: e.target.value })} placeholder="公钥（分享给客户端）" className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Short IDs (逗号分隔)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={generateShortIds}>
                <RefreshCw className="h-3 w-3 mr-1" />生成
              </Button>
            </div>
            <Input value={value.realityShortIds ?? ''} onChange={e => update({ realityShortIds: e.target.value })} placeholder="多个不同长度的 hex" className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">SpiderX</Label>
            <Input value={value.realitySpiderX ?? ''} onChange={e => update({ realitySpiderX: e.target.value })} placeholder="/" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Fingerprint</Label>
            <Select value={value.realityFingerprint ?? 'chrome'} onValueChange={v => update({ realityFingerprint: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINGERPRINTS.map(fp => (
                  <SelectItem key={fp} value={fp}>{fp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Xver</Label>
            <Select value={String(value.realityXver ?? 0)} onValueChange={v => update({ realityXver: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show</Label>
            <Switch checked={value.realityShow ?? false} onCheckedChange={v => update({ realityShow: v })} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Max Time Diff (ms)</Label>
            <Input
              type="number"
              value={value.realityMaxTimediff ?? 0}
              onChange={e => update({ realityMaxTimediff: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Min Client Ver</Label>
              <Input value={value.realityMinClientVer ?? ''} onChange={e => update({ realityMinClientVer: e.target.value })} placeholder="" className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Client Ver</Label>
              <Input value={value.realityMaxClientVer ?? ''} onChange={e => update({ realityMaxClientVer: e.target.value })} placeholder="" className="text-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── JSON build / parse ──

export function buildSecurityJson(form: SecurityForm): Record<string, any> {
  const result: Record<string, any> = { security: form.security };

  if (form.security === 'tls') {
    const tlsSettings: Record<string, any> = {};
    if (form.tlsServerName) tlsSettings.serverName = form.tlsServerName;
    if (form.tlsMinVersion && form.tlsMinVersion !== '1.2') tlsSettings.minVersion = form.tlsMinVersion;
    if (form.tlsMaxVersion && form.tlsMaxVersion !== '1.3') tlsSettings.maxVersion = form.tlsMaxVersion;
    const alpn = form.tlsAlpn || ['h2', 'http/1.1'];
    if (alpn.length > 0) tlsSettings.alpn = alpn;
    if (form.tlsFingerprint) tlsSettings.fingerprint = form.tlsFingerprint;
    if (form.tlsRejectUnknownSni) tlsSettings.rejectUnknownSni = true;
    if (form.tlsAllowInsecure) tlsSettings.allowInsecure = true;
    if (form.tlsCipherSuites) tlsSettings.cipherSuites = form.tlsCipherSuites;
    if (form.tlsDisableSystemRoot) tlsSettings.disableSystemRoot = true;
    if (form.tlsSessionResumption) tlsSettings.sessionResumption = true;
    // Certificates
    if (form.tlsCerts && form.tlsCerts.length > 0) {
      tlsSettings.certificates = form.tlsCerts.map(cert => {
        const c: Record<string, any> = {};
        if (cert.useFile) {
          if (cert.certFile) c.certificateFile = cert.certFile;
          if (cert.keyFile) c.keyFile = cert.keyFile;
        } else {
          if (cert.cert) c.certificate = cert.cert.split('\n');
          if (cert.key) c.key = cert.key.split('\n');
        }
        if (cert.usage) c.usage = cert.usage;
        if (cert.oneTimeLoading) c.oneTimeLoading = true;
        if (cert.buildChain) c.buildChain = true;
        return c;
      });
    }
    result.tlsSettings = tlsSettings;
  }

  if (form.security === 'reality') {
    const realitySettings: Record<string, any> = {};
    if (form.realityDest) realitySettings.dest = form.realityDest;
    if (form.realityServerNames) {
      realitySettings.serverNames = form.realityServerNames.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (form.realityPrivateKey) realitySettings.privateKey = form.realityPrivateKey;
    if (form.realityPublicKey) realitySettings.publicKey = form.realityPublicKey;
    if (form.realityShortIds) {
      realitySettings.shortIds = form.realityShortIds.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (form.realitySpiderX) realitySettings.spiderX = form.realitySpiderX;
    if (form.realityFingerprint) realitySettings.fingerprint = form.realityFingerprint;
    if (form.realityXver !== undefined) realitySettings.xver = form.realityXver;
    if (form.realityShow) realitySettings.show = true;
    if (form.realityMaxTimediff) realitySettings.maxTimeDiff = form.realityMaxTimediff;
    if (form.realityMinClientVer) realitySettings.minClientVer = form.realityMinClientVer;
    if (form.realityMaxClientVer) realitySettings.maxClientVer = form.realityMaxClientVer;
    result.realitySettings = realitySettings;
  }

  return result;
}

export function parseSecurityJson(streamObj: Record<string, any>): SecurityForm {
  const security = streamObj.security || 'none';
  const form: SecurityForm = { security };

  if (security === 'tls') {
    const tls = streamObj.tlsSettings || {};
    form.tlsServerName = tls.serverName || '';
    form.tlsMinVersion = tls.minVersion || '1.2';
    form.tlsMaxVersion = tls.maxVersion || '1.3';
    form.tlsAlpn = tls.alpn || ['h2', 'http/1.1'];
    form.tlsFingerprint = tls.fingerprint || 'chrome';
    form.tlsRejectUnknownSni = tls.rejectUnknownSni ?? false;
    form.tlsAllowInsecure = tls.allowInsecure ?? false;
    form.tlsCipherSuites = tls.cipherSuites || '';
    form.tlsDisableSystemRoot = tls.disableSystemRoot ?? false;
    form.tlsSessionResumption = tls.sessionResumption ?? false;
    // Parse certificates
    if (tls.certificates && Array.isArray(tls.certificates)) {
      form.tlsCerts = tls.certificates.map((c: any) => {
        const cert: TlsCertItem = {
          useFile: !!(c.certificateFile || c.keyFile),
          certFile: c.certificateFile || '',
          keyFile: c.keyFile || '',
          cert: Array.isArray(c.certificate) ? c.certificate.join('\n') : (c.certificate || ''),
          key: Array.isArray(c.key) ? c.key.join('\n') : (c.key || ''),
          usage: c.usage || 'encipherment',
          oneTimeLoading: c.oneTimeLoading ?? false,
          buildChain: c.buildChain ?? false,
        };
        return cert;
      });
    }
  }

  if (security === 'reality') {
    const r = streamObj.realitySettings || {};
    form.realityDest = r.dest || '';
    form.realityServerNames = (r.serverNames || []).join(', ');
    form.realityPrivateKey = r.privateKey || '';
    form.realityPublicKey = r.publicKey || '';
    form.realityShortIds = (r.shortIds || []).join(', ');
    form.realitySpiderX = r.spiderX || '';
    form.realityFingerprint = r.fingerprint || 'chrome';
    form.realityXver = r.xver ?? 0;
    form.realityShow = r.show ?? false;
    form.realityMaxTimediff = r.maxTimeDiff ?? 0;
    form.realityMinClientVer = r.minClientVer || '';
    form.realityMaxClientVer = r.maxClientVer || '';
  }

  return form;
}
