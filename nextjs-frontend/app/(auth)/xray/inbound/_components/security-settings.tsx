'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw } from 'lucide-react';

// ── Types ──

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
  // Reality
  realityDest?: string;
  realityServerNames?: string;
  realityPrivateKey?: string;
  realityPublicKey?: string;
  realityShortIds?: string;
  realitySpiderX?: string;
  realityFingerprint?: string;
  realityXver?: number;
}

interface Props {
  value: SecurityForm;
  onChange: (v: SecurityForm) => void;
}

const FINGERPRINTS = [
  'chrome', 'firefox', 'safari', 'ios', 'android',
  'edge', '360', 'qq', 'random', 'randomized',
];

const ALPN_OPTIONS = ['h3', 'h2', 'http/1.1'];

// ── Component ──

export default function SecuritySettings({ value, onChange }: Props) {
  const update = (patch: Partial<SecurityForm>) => onChange({ ...value, ...patch });

  const generateX25519 = async () => {
    try {
      const keyPair = await crypto.subtle.generateKey({ name: 'X25519' } as any, true, ['deriveBits']) as CryptoKeyPair;
      const privRaw = await crypto.subtle.exportKey('raw', keyPair.privateKey);
      const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const toBase64Url = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      update({
        realityPrivateKey: toBase64Url(privRaw),
        realityPublicKey: toBase64Url(pubRaw),
      });
    } catch {
      // Fallback: generate random hex strings
      const randomHex = (len: number) => {
        const arr = new Uint8Array(len);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      };
      update({
        realityPrivateKey: randomHex(32),
        realityPublicKey: randomHex(32),
      });
    }
  };

  const generateShortId = () => {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    const id = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    update({ realityShortIds: id });
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
          <div className="flex items-center justify-between">
            <Label className="text-xs">Reject Unknown SNI</Label>
            <Switch checked={value.tlsRejectUnknownSni ?? false} onCheckedChange={v => update({ tlsRejectUnknownSni: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Allow Insecure</Label>
            <Switch checked={value.tlsAllowInsecure ?? false} onCheckedChange={v => update({ tlsAllowInsecure: v })} />
          </div>
        </div>
      )}

      {/* Reality */}
      {value.security === 'reality' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Dest (目标)</Label>
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
              <Button type="button" variant="ghost" size="sm" onClick={generateShortId}>
                <RefreshCw className="h-3 w-3 mr-1" />生成
              </Button>
            </div>
            <Input value={value.realityShortIds ?? ''} onChange={e => update({ realityShortIds: e.target.value })} placeholder="0123456789abcdef" className="text-sm font-mono" />
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
  }

  return form;
}
