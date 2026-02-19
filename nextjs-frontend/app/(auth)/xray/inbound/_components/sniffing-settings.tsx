'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

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
        <Label>嗅探 (Sniffing)</Label>
        <Switch checked={value.enabled} onCheckedChange={v => update({ enabled: v })} />
      </div>

      {value.enabled && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <div className="space-y-2">
            <Label className="text-xs">Dest Override</Label>
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
            <Label className="text-xs">Metadata Only</Label>
            <Switch checked={value.metadataOnly} onCheckedChange={v => update({ metadataOnly: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Route Only</Label>
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
      destOverride: obj.destOverride || ['http', 'tls'],
      metadataOnly: obj.metadataOnly ?? false,
      routeOnly: obj.routeOnly ?? false,
    };
  } catch {
    return {
      enabled: true,
      destOverride: ['http', 'tls'],
      metadataOnly: false,
      routeOnly: false,
    };
  }
}
