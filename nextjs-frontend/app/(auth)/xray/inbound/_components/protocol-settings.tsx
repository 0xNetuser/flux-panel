'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, RefreshCw, Shuffle } from 'lucide-react';
import { randomShadowsocksPassword } from '@/lib/utils/random';

// ── Types ──

export interface FallbackItem {
  name: string;
  alpn: string;
  path: string;
  dest: string;
  xver: number;
}

export interface ProtocolForm {
  // VLESS
  decryption?: string;
  // VLESS Fallbacks
  fallbacks?: FallbackItem[];
  // Shadowsocks
  method?: string;
  password?: string;
  network?: string;
  ivCheck?: boolean;
}

interface Props {
  protocol: string;
  value: ProtocolForm;
  onChange: (v: ProtocolForm) => void;
  /** Current transport network type, needed for conditional UI */
  transportNetwork?: string;
  /** Current security type, needed for conditional UI */
  securityType?: string;
}

// ── Fallbacks Editor ──

function FallbacksEditor({ fallbacks, onChange }: { fallbacks: FallbackItem[]; onChange: (fb: FallbackItem[]) => void }) {
  const addFallback = () => {
    onChange([...fallbacks, { name: '', alpn: '', path: '', dest: '', xver: 0 }]);
  };

  const removeFallback = (index: number) => {
    onChange(fallbacks.filter((_, i) => i !== index));
  };

  const updateFallback = (index: number, patch: Partial<FallbackItem>) => {
    const next = [...fallbacks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Fallbacks</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addFallback}>
          <Plus className="h-3 w-3 mr-1" />添加
        </Button>
      </div>
      {fallbacks.length === 0 && (
        <p className="text-xs text-muted-foreground">无 Fallback 配置</p>
      )}
      {fallbacks.map((fb, i) => (
        <div key={i} className="space-y-2 p-3 border rounded-md relative">
          <Button
            type="button" variant="ghost" size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => removeFallback(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">SNI (Name)</Label>
              <Input className="text-xs h-8" value={fb.name} onChange={e => updateFallback(i, { name: e.target.value })} placeholder="" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ALPN</Label>
              <Input className="text-xs h-8" value={fb.alpn} onChange={e => updateFallback(i, { alpn: e.target.value })} placeholder="" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Path</Label>
              <Input className="text-xs h-8" value={fb.path} onChange={e => updateFallback(i, { path: e.target.value })} placeholder="" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dest</Label>
              <Input className="text-xs h-8" value={fb.dest} onChange={e => updateFallback(i, { dest: e.target.value })} placeholder="80" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">xVer</Label>
            <Select value={String(fb.xver)} onValueChange={v => updateFallback(i, { xver: parseInt(v) })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Component ──

export default function ProtocolSettings({ protocol, value, onChange, transportNetwork, securityType }: Props) {
  const update = (patch: Partial<ProtocolForm>) => onChange({ ...value, ...patch });

  const isTCP = !transportNetwork || transportNetwork === 'tcp';
  const isSS2022 = (value.method || '').startsWith('2022-blake3');

  switch (protocol) {
    case 'vmess':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">VMess 协议设置（客户端从入站展开行中管理）</p>
        </div>
      );

    case 'vless':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Decryption</Label>
            <Input
              value={value.decryption ?? 'none'}
              onChange={e => update({ decryption: e.target.value })}
              placeholder="none"
            />
          </div>
          {/* Fallbacks — only shown for TCP transport */}
          {isTCP && (
            <FallbacksEditor
              fallbacks={value.fallbacks || []}
              onChange={fb => update({ fallbacks: fb })}
            />
          )}
        </div>
      );

    case 'trojan':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Trojan 协议设置（客户端从入站展开行中管理）</p>
          {/* Fallbacks — only shown for TCP transport */}
          {isTCP && (
            <FallbacksEditor
              fallbacks={value.fallbacks || []}
              onChange={fb => update({ fallbacks: fb })}
            />
          )}
        </div>
      );

    case 'shadowsocks':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>加密方式</Label>
              <Select value={value.method ?? 'aes-256-gcm'} onValueChange={v => update({ method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aes-128-gcm">aes-128-gcm</SelectItem>
                  <SelectItem value="aes-256-gcm">aes-256-gcm</SelectItem>
                  <SelectItem value="chacha20-poly1305">chacha20-poly1305</SelectItem>
                  <SelectItem value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</SelectItem>
                  <SelectItem value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</SelectItem>
                  <SelectItem value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</SelectItem>
                  <SelectItem value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</SelectItem>
                  <SelectItem value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Network</Label>
              <Select value={value.network ?? 'tcp,udp'} onValueChange={v => update({ network: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp,udp">tcp,udp</SelectItem>
                  <SelectItem value="tcp">tcp</SelectItem>
                  <SelectItem value="udp">udp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* SS2022 Password */}
          {isSS2022 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SS2022 密码</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => update({ password: randomShadowsocksPassword(value.method) })}>
                  <Shuffle className="h-3 w-3 mr-1" />随机生成
                </Button>
              </div>
              <Input
                value={value.password ?? ''}
                onChange={e => update({ password: e.target.value })}
                placeholder="Base64 编码密码"
                className="font-mono text-sm"
              />
            </div>
          )}
          {/* ivCheck */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">IV Check</Label>
            <Switch checked={value.ivCheck ?? false} onCheckedChange={v => update({ ivCheck: v })} />
          </div>
        </div>
      );

    default:
      return <p className="text-sm text-muted-foreground">未知协议: {protocol}</p>;
  }
}

// ── JSON build / parse ──

export function buildSettingsJson(protocol: string, form: ProtocolForm): string {
  switch (protocol) {
    case 'vmess':
      return JSON.stringify({ clients: [] });

    case 'vless': {
      const obj: Record<string, any> = {
        clients: [],
        decryption: form.decryption || 'none',
      };
      if (form.fallbacks && form.fallbacks.length > 0) {
        obj.fallbacks = form.fallbacks.map(fb => {
          const item: Record<string, any> = {};
          if (fb.name) item.name = fb.name;
          if (fb.alpn) item.alpn = fb.alpn;
          if (fb.path) item.path = fb.path;
          if (fb.dest) item.dest = fb.dest;
          if (fb.xver) item.xver = fb.xver;
          return item;
        });
      }
      return JSON.stringify(obj);
    }

    case 'trojan': {
      const obj: Record<string, any> = { clients: [] };
      if (form.fallbacks && form.fallbacks.length > 0) {
        obj.fallbacks = form.fallbacks.map(fb => {
          const item: Record<string, any> = {};
          if (fb.name) item.name = fb.name;
          if (fb.alpn) item.alpn = fb.alpn;
          if (fb.path) item.path = fb.path;
          if (fb.dest) item.dest = fb.dest;
          if (fb.xver) item.xver = fb.xver;
          return item;
        });
      }
      return JSON.stringify(obj);
    }

    case 'shadowsocks': {
      const obj: Record<string, any> = {
        clients: [],
        method: form.method || 'aes-256-gcm',
        network: form.network || 'tcp,udp',
      };
      if (form.password) obj.password = form.password;
      if (form.ivCheck) obj.ivCheck = true;
      return JSON.stringify(obj);
    }

    default:
      return '{}';
  }
}

export function parseSettingsJson(protocol: string, json: string): ProtocolForm {
  try {
    const obj = JSON.parse(json);
    switch (protocol) {
      case 'vless': {
        const form: ProtocolForm = { decryption: obj.decryption || 'none' };
        if (obj.fallbacks && Array.isArray(obj.fallbacks)) {
          form.fallbacks = obj.fallbacks.map((fb: any) => ({
            name: fb.name || '',
            alpn: fb.alpn || '',
            path: fb.path || '',
            dest: fb.dest?.toString() || '',
            xver: fb.xver || 0,
          }));
        }
        return form;
      }
      case 'trojan': {
        const form: ProtocolForm = {};
        if (obj.fallbacks && Array.isArray(obj.fallbacks)) {
          form.fallbacks = obj.fallbacks.map((fb: any) => ({
            name: fb.name || '',
            alpn: fb.alpn || '',
            path: fb.path || '',
            dest: fb.dest?.toString() || '',
            xver: fb.xver || 0,
          }));
        }
        return form;
      }
      case 'shadowsocks':
        return {
          method: obj.method || 'aes-256-gcm',
          network: obj.network || 'tcp,udp',
          password: obj.password || '',
          ivCheck: obj.ivCheck ?? false,
        };
      default:
        return {};
    }
  } catch {
    return {};
  }
}
