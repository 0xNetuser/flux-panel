'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import FieldTip from './field-tip';

// ── Types ──

export interface SniffingForm {
  enabled: boolean;
  destOverride: string[];
  metadataOnly: boolean;
  routeOnly: boolean;
}

interface Props {
  value: SniffingForm;
  onChange: (v: SniffingForm) => void;
}

const DEST_OVERRIDE_OPTIONS = ['http', 'tls', 'quic', 'fakedns'];

// ── Component ──

export default function SniffingSettings({ value, onChange }: Props) {
  const update = (patch: Partial<SniffingForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="inline-flex items-center gap-1">嗅探 (Sniffing) <FieldTip content="开启后可通过分析流量内容嗅探出目标域名，用于精确路由和 DNS 解析" /></Label>
        <Switch checked={value.enabled} onCheckedChange={v => update({ enabled: v })} />
      </div>

      {value.enabled && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs inline-flex items-center gap-1">Dest Override <FieldTip content="将嗅探到的域名覆盖连接目标地址。http 嗅探 HTTP 请求 Host；tls 嗅探 TLS SNI；quic 嗅探 QUIC SNI；fakedns 使用 FakeDNS 映射还原域名" /></Label>
            <div className="flex gap-4">
              {DEST_OVERRIDE_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={value.destOverride.includes(opt)}
                    onCheckedChange={checked => {
                      const next = checked
                        ? [...value.destOverride, opt]
                        : value.destOverride.filter(d => d !== opt);
                      update({ destOverride: next });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs inline-flex items-center gap-1">Metadata Only <FieldTip content="仅使用连接的元数据 (如 IP、端口) 嗅探，不检查数据包内容，性能更好但准确率更低" /></Label>
            <Switch checked={value.metadataOnly} onCheckedChange={v => update({ metadataOnly: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs inline-flex items-center gap-1">Route Only <FieldTip content="嗅探结果仅用于路由判断，不会覆盖实际目标地址。建议开启，避免因域名覆盖导致部分应用异常" /></Label>
            <Switch checked={value.routeOnly} onCheckedChange={v => update({ routeOnly: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── JSON build / parse ──

export function buildSniffingJson(form: SniffingForm): string {
  return JSON.stringify({
    enabled: form.enabled,
    destOverride: form.destOverride,
    metadataOnly: form.metadataOnly,
    routeOnly: form.routeOnly,
  });
}

export function parseSniffingJson(json: string): SniffingForm {
  try {
    const obj = JSON.parse(json);
    return {
      enabled: obj.enabled ?? true,
      destOverride: obj.destOverride || ['http', 'tls', 'quic', 'fakedns'],
      metadataOnly: obj.metadataOnly ?? false,
      routeOnly: obj.routeOnly ?? true,
    };
  } catch {
    return {
      enabled: true,
      destOverride: ['http', 'tls', 'quic', 'fakedns'],
      metadataOnly: false,
      routeOnly: true,
    };
  }
}
