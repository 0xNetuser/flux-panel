'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Types ──

export interface ProtocolForm {
  // VMess / VLESS common
  decryption?: string;
  fallbacks?: string; // JSON string for advanced fallbacks
  // Shadowsocks
  method?: string;
  network?: string; // "tcp,udp" etc
}

interface Props {
  protocol: string;
  value: ProtocolForm;
  onChange: (v: ProtocolForm) => void;
}

// ── Component ──

export default function ProtocolSettings({ protocol, value, onChange }: Props) {
  const update = (patch: Partial<ProtocolForm>) => onChange({ ...value, ...patch });

  switch (protocol) {
    case 'vmess':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">VMess 协议设置（客户端通过客户端管理页面添加）</p>
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
          <p className="text-xs text-muted-foreground">VLESS 客户端通过客户端管理页面添加</p>
        </div>
      );

    case 'trojan':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Trojan 协议设置（客户端通过客户端管理页面添加）</p>
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

    case 'vless':
      return JSON.stringify({
        clients: [],
        decryption: form.decryption || 'none',
      });

    case 'trojan':
      return JSON.stringify({ clients: [] });

    case 'shadowsocks':
      return JSON.stringify({
        clients: [],
        method: form.method || 'aes-256-gcm',
        network: form.network || 'tcp,udp',
      });

    default:
      return '{}';
  }
}

export function parseSettingsJson(protocol: string, json: string): ProtocolForm {
  try {
    const obj = JSON.parse(json);
    switch (protocol) {
      case 'vless':
        return { decryption: obj.decryption || 'none' };
      case 'shadowsocks':
        return {
          method: obj.method || 'aes-256-gcm',
          network: obj.network || 'tcp,udp',
        };
      default:
        return {};
    }
  } catch {
    return {};
  }
}
