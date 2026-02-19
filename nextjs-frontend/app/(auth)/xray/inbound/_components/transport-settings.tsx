'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

// ── Types ──

export interface TransportForm {
  network: string;
  // TCP
  tcpHeaderType?: string;
  tcpHttpPath?: string;
  tcpHttpHost?: string;
  // WebSocket
  wsPath?: string;
  wsHost?: string;
  wsHeaders?: Record<string, string>;
  // gRPC
  grpcServiceName?: string;
  grpcAuthority?: string;
  grpcMultiMode?: boolean;
  // HTTPUpgrade
  httpupgradePath?: string;
  httpupgradeHost?: string;
  httpupgradeHeaders?: Record<string, string>;
  // xHTTP (splithttp)
  xhttpPath?: string;
  xhttpHost?: string;
  xhttpHeaders?: Record<string, string>;
  // kcp
  kcpMtu?: number;
  kcpTti?: number;
  kcpUplinkCapacity?: number;
  kcpDownlinkCapacity?: number;
  kcpCongestion?: boolean;
  kcpReadBufferSize?: number;
  kcpWriteBufferSize?: number;
  kcpSeed?: string;
  kcpHeaderType?: string;
  // Common
  acceptProxyProtocol?: boolean;
}

interface Props {
  value: TransportForm;
  onChange: (v: TransportForm) => void;
}

// ── Header key-value editor ──

function HeadersEditor({ headers, onChange }: { headers: Record<string, string>; onChange: (h: Record<string, string>) => void }) {
  const entries = Object.entries(headers);

  const addHeader = () => onChange({ ...headers, '': '' });
  const removeHeader = (key: string) => {
    const next = { ...headers };
    delete next[key];
    onChange(next);
  };
  const updateKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };
  const updateValue = (key: string, val: string) => {
    onChange({ ...headers, [key]: val });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Headers</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addHeader}>
          <Plus className="h-3 w-3 mr-1" />添加
        </Button>
      </div>
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="text-xs"
            placeholder="Key"
            value={k}
            onChange={e => updateKey(k, e.target.value)}
          />
          <Input
            className="text-xs"
            placeholder="Value"
            value={v}
            onChange={e => updateValue(k, e.target.value)}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeHeader(k)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Component ──

export default function TransportSettings({ value, onChange }: Props) {
  const update = (patch: Partial<TransportForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Network (传输协议)</Label>
        <Select value={value.network} onValueChange={v => update({ network: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tcp">TCP</SelectItem>
            <SelectItem value="ws">WebSocket</SelectItem>
            <SelectItem value="grpc">gRPC</SelectItem>
            <SelectItem value="httpupgrade">HTTPUpgrade</SelectItem>
            <SelectItem value="xhttp">xHTTP (SplitHTTP)</SelectItem>
            <SelectItem value="kcp">mKCP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TCP */}
      {value.network === 'tcp' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Header Type</Label>
            <Select value={value.tcpHeaderType ?? 'none'} onValueChange={v => update({ tcpHeaderType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="http">http</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {value.tcpHeaderType === 'http' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">HTTP Path</Label>
                <Input value={value.tcpHttpPath ?? '/'} onChange={e => update({ tcpHttpPath: e.target.value })} placeholder="/" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">HTTP Host</Label>
                <Input value={value.tcpHttpHost ?? ''} onChange={e => update({ tcpHttpHost: e.target.value })} placeholder="example.com" className="text-sm" />
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Accept Proxy Protocol</Label>
            <Switch checked={value.acceptProxyProtocol ?? false} onCheckedChange={v => update({ acceptProxyProtocol: v })} />
          </div>
        </div>
      )}

      {/* WebSocket */}
      {value.network === 'ws' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Path</Label>
            <Input value={value.wsPath ?? '/'} onChange={e => update({ wsPath: e.target.value })} placeholder="/" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Host</Label>
            <Input value={value.wsHost ?? ''} onChange={e => update({ wsHost: e.target.value })} placeholder="example.com" className="text-sm" />
          </div>
          <HeadersEditor headers={value.wsHeaders ?? {}} onChange={h => update({ wsHeaders: h })} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Accept Proxy Protocol</Label>
            <Switch checked={value.acceptProxyProtocol ?? false} onCheckedChange={v => update({ acceptProxyProtocol: v })} />
          </div>
        </div>
      )}

      {/* gRPC */}
      {value.network === 'grpc' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Service Name</Label>
            <Input value={value.grpcServiceName ?? ''} onChange={e => update({ grpcServiceName: e.target.value })} placeholder="GunService" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Authority</Label>
            <Input value={value.grpcAuthority ?? ''} onChange={e => update({ grpcAuthority: e.target.value })} placeholder="" className="text-sm" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Multi Mode</Label>
            <Switch checked={value.grpcMultiMode ?? false} onCheckedChange={v => update({ grpcMultiMode: v })} />
          </div>
        </div>
      )}

      {/* HTTPUpgrade */}
      {value.network === 'httpupgrade' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Path</Label>
            <Input value={value.httpupgradePath ?? '/'} onChange={e => update({ httpupgradePath: e.target.value })} placeholder="/" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Host</Label>
            <Input value={value.httpupgradeHost ?? ''} onChange={e => update({ httpupgradeHost: e.target.value })} placeholder="example.com" className="text-sm" />
          </div>
          <HeadersEditor headers={value.httpupgradeHeaders ?? {}} onChange={h => update({ httpupgradeHeaders: h })} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Accept Proxy Protocol</Label>
            <Switch checked={value.acceptProxyProtocol ?? false} onCheckedChange={v => update({ acceptProxyProtocol: v })} />
          </div>
        </div>
      )}

      {/* xHTTP */}
      {value.network === 'xhttp' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Path</Label>
            <Input value={value.xhttpPath ?? '/'} onChange={e => update({ xhttpPath: e.target.value })} placeholder="/" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Host</Label>
            <Input value={value.xhttpHost ?? ''} onChange={e => update({ xhttpHost: e.target.value })} placeholder="example.com" className="text-sm" />
          </div>
          <HeadersEditor headers={value.xhttpHeaders ?? {}} onChange={h => update({ xhttpHeaders: h })} />
        </div>
      )}

      {/* mKCP */}
      {value.network === 'kcp' && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">MTU</Label>
              <Input type="number" value={value.kcpMtu ?? 1350} onChange={e => update({ kcpMtu: parseInt(e.target.value) || 1350 })} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">TTI</Label>
              <Input type="number" value={value.kcpTti ?? 50} onChange={e => update({ kcpTti: parseInt(e.target.value) || 50 })} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Uplink Capacity</Label>
              <Input type="number" value={value.kcpUplinkCapacity ?? 5} onChange={e => update({ kcpUplinkCapacity: parseInt(e.target.value) || 5 })} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Downlink Capacity</Label>
              <Input type="number" value={value.kcpDownlinkCapacity ?? 20} onChange={e => update({ kcpDownlinkCapacity: parseInt(e.target.value) || 20 })} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Read Buffer Size</Label>
              <Input type="number" value={value.kcpReadBufferSize ?? 2} onChange={e => update({ kcpReadBufferSize: parseInt(e.target.value) || 2 })} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Write Buffer Size</Label>
              <Input type="number" value={value.kcpWriteBufferSize ?? 2} onChange={e => update({ kcpWriteBufferSize: parseInt(e.target.value) || 2 })} className="text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Seed (混淆密码)</Label>
            <Input value={value.kcpSeed ?? ''} onChange={e => update({ kcpSeed: e.target.value })} placeholder="可选" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Header Type (伪装)</Label>
            <Select value={value.kcpHeaderType ?? 'none'} onValueChange={v => update({ kcpHeaderType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="srtp">srtp</SelectItem>
                <SelectItem value="utp">utp</SelectItem>
                <SelectItem value="wechat-video">wechat-video</SelectItem>
                <SelectItem value="dtls">dtls</SelectItem>
                <SelectItem value="wireguard">wireguard</SelectItem>
                <SelectItem value="dns">dns</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Congestion</Label>
            <Switch checked={value.kcpCongestion ?? false} onCheckedChange={v => update({ kcpCongestion: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── JSON build / parse ──

export function buildTransportJson(form: TransportForm): Record<string, any> {
  const stream: Record<string, any> = { network: form.network };

  switch (form.network) {
    case 'tcp': {
      const tcpSettings: Record<string, any> = {};
      if (form.tcpHeaderType && form.tcpHeaderType !== 'none') {
        tcpSettings.header = {
          type: form.tcpHeaderType,
          request: {
            path: [form.tcpHttpPath || '/'],
            headers: form.tcpHttpHost ? { Host: [form.tcpHttpHost] } : {},
          },
        };
      }
      if (form.acceptProxyProtocol) tcpSettings.acceptProxyProtocol = true;
      if (Object.keys(tcpSettings).length > 0) stream.tcpSettings = tcpSettings;
      break;
    }
    case 'ws': {
      const wsSettings: Record<string, any> = {
        path: form.wsPath || '/',
      };
      const headers: Record<string, string> = { ...(form.wsHeaders || {}) };
      if (form.wsHost) headers['Host'] = form.wsHost;
      if (Object.keys(headers).length > 0) wsSettings.headers = headers;
      if (form.acceptProxyProtocol) wsSettings.acceptProxyProtocol = true;
      stream.wsSettings = wsSettings;
      break;
    }
    case 'grpc': {
      const grpcSettings: Record<string, any> = {
        serviceName: form.grpcServiceName || '',
      };
      if (form.grpcAuthority) grpcSettings.authority = form.grpcAuthority;
      if (form.grpcMultiMode) grpcSettings.multiMode = true;
      stream.grpcSettings = grpcSettings;
      break;
    }
    case 'httpupgrade': {
      const settings: Record<string, any> = {
        path: form.httpupgradePath || '/',
      };
      if (form.httpupgradeHost) settings.host = form.httpupgradeHost;
      const headers = form.httpupgradeHeaders || {};
      if (Object.keys(headers).length > 0) settings.headers = headers;
      if (form.acceptProxyProtocol) settings.acceptProxyProtocol = true;
      stream.httpupgradeSettings = settings;
      break;
    }
    case 'xhttp': {
      const settings: Record<string, any> = {
        path: form.xhttpPath || '/',
      };
      if (form.xhttpHost) settings.host = form.xhttpHost;
      const headers = form.xhttpHeaders || {};
      if (Object.keys(headers).length > 0) settings.headers = headers;
      stream.xhttpSettings = settings;
      break;
    }
    case 'kcp': {
      const kcpSettings: Record<string, any> = {
        mtu: form.kcpMtu ?? 1350,
        tti: form.kcpTti ?? 50,
        uplinkCapacity: form.kcpUplinkCapacity ?? 5,
        downlinkCapacity: form.kcpDownlinkCapacity ?? 20,
        congestion: form.kcpCongestion ?? false,
        readBufferSize: form.kcpReadBufferSize ?? 2,
        writeBufferSize: form.kcpWriteBufferSize ?? 2,
        header: { type: form.kcpHeaderType || 'none' },
      };
      if (form.kcpSeed) kcpSettings.seed = form.kcpSeed;
      stream.kcpSettings = kcpSettings;
      break;
    }
  }

  return stream;
}

export function parseTransportJson(streamObj: Record<string, any>): TransportForm {
  const network = streamObj.network || 'tcp';
  const form: TransportForm = { network };

  switch (network) {
    case 'tcp': {
      const tcp = streamObj.tcpSettings || {};
      const header = tcp.header || {};
      form.tcpHeaderType = header.type || 'none';
      if (header.type === 'http' && header.request) {
        form.tcpHttpPath = (header.request.path || ['/'])[0];
        const hostArr = header.request.headers?.Host;
        form.tcpHttpHost = Array.isArray(hostArr) ? hostArr[0] : (hostArr || '');
      }
      form.acceptProxyProtocol = tcp.acceptProxyProtocol ?? false;
      break;
    }
    case 'ws': {
      const ws = streamObj.wsSettings || {};
      form.wsPath = ws.path || '/';
      const headers = { ...(ws.headers || {}) };
      form.wsHost = headers['Host'] || '';
      delete headers['Host'];
      form.wsHeaders = headers;
      form.acceptProxyProtocol = ws.acceptProxyProtocol ?? false;
      break;
    }
    case 'grpc': {
      const grpc = streamObj.grpcSettings || {};
      form.grpcServiceName = grpc.serviceName || '';
      form.grpcAuthority = grpc.authority || '';
      form.grpcMultiMode = grpc.multiMode ?? false;
      break;
    }
    case 'httpupgrade': {
      const h = streamObj.httpupgradeSettings || {};
      form.httpupgradePath = h.path || '/';
      form.httpupgradeHost = h.host || '';
      form.httpupgradeHeaders = h.headers || {};
      form.acceptProxyProtocol = h.acceptProxyProtocol ?? false;
      break;
    }
    case 'xhttp': {
      const x = streamObj.xhttpSettings || {};
      form.xhttpPath = x.path || '/';
      form.xhttpHost = x.host || '';
      form.xhttpHeaders = x.headers || {};
      break;
    }
    case 'kcp': {
      const kcp = streamObj.kcpSettings || {};
      form.kcpMtu = kcp.mtu ?? 1350;
      form.kcpTti = kcp.tti ?? 50;
      form.kcpUplinkCapacity = kcp.uplinkCapacity ?? 5;
      form.kcpDownlinkCapacity = kcp.downlinkCapacity ?? 20;
      form.kcpCongestion = kcp.congestion ?? false;
      form.kcpReadBufferSize = kcp.readBufferSize ?? 2;
      form.kcpWriteBufferSize = kcp.writeBufferSize ?? 2;
      form.kcpSeed = kcp.seed || '';
      form.kcpHeaderType = kcp.header?.type || 'none';
      break;
    }
  }

  return form;
}
