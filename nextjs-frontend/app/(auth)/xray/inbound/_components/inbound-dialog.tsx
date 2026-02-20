'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

import { Loader2 } from 'lucide-react';
import FieldTip from './field-tip';
import ProtocolSettings, { type ProtocolForm, buildSettingsJson, parseSettingsJson } from './protocol-settings';
import TransportSettings, { type TransportForm, buildTransportJson, parseTransportJson } from './transport-settings';
import SecuritySettings, { type SecurityForm, buildSecurityJson, parseSecurityJson } from './security-settings';
import SniffingSettings, { type SniffingForm, buildSniffingJson, parseSniffingJson } from './sniffing-settings';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingInbound: any;
  nodes: any[];
  onSubmit: (data: any) => Promise<void>;
  submitting?: boolean;
}

export default function InboundDialog({ open, onOpenChange, editingInbound, nodes, onSubmit, submitting = false }: Props) {
  // Basic fields
  const [nodeId, setNodeId] = useState('');
  const [protocol, setProtocol] = useState('vmess');
  const [tag, setTag] = useState('');
  const [port, setPort] = useState('');
  const [listen, setListen] = useState('0.0.0.0');
  const [remark, setRemark] = useState('');

  // Structured form states
  const [protocolForm, setProtocolForm] = useState<ProtocolForm>({});
  const [transportForm, setTransportForm] = useState<TransportForm>({ network: 'tcp' });
  const [securityForm, setSecurityForm] = useState<SecurityForm>({ security: 'none' });
  const [sniffingForm, setSniffingForm] = useState<SniffingForm>({
    enabled: false, destOverride: ['http', 'tls', 'quic', 'fakedns'], metadataOnly: false, routeOnly: true,
  });

  // Advanced mode (raw JSON)
  const [advancedMode, setAdvancedMode] = useState(false);
  const [rawSettingsJson, setRawSettingsJson] = useState('{}');
  const [rawStreamSettingsJson, setRawStreamSettingsJson] = useState('{}');
  const [rawSniffingJson, setRawSniffingJson] = useState('{}');

  // Generate random port placeholder for new inbound
  const [portPlaceholder] = useState(() => String(Math.floor(Math.random() * 50001) + 10000));

  // Initialize form when dialog opens or editing target changes
  useEffect(() => {
    if (!open) return;

    if (editingInbound) {
      setNodeId(editingInbound.nodeId?.toString() || '');
      setProtocol(editingInbound.protocol || 'vmess');
      setTag(editingInbound.tag || '');
      setPort(editingInbound.port?.toString() || '');
      setListen(editingInbound.listen || '0.0.0.0');
      setRemark(editingInbound.remark || '');

      const settingsStr = editingInbound.settingsJson || editingInbound.settings || '{}';
      const streamStr = editingInbound.streamSettingsJson || editingInbound.streamSettings || '{}';
      const sniffingStr = editingInbound.sniffingJson || editingInbound.sniffing || '{}';

      // Parse into structured form
      setProtocolForm(parseSettingsJson(editingInbound.protocol || 'vmess', settingsStr));
      try {
        const streamObj = JSON.parse(streamStr);
        setTransportForm(parseTransportJson(streamObj));
        setSecurityForm(parseSecurityJson(streamObj));
      } catch {
        setTransportForm({ network: 'tcp' });
        setSecurityForm({ security: 'none' });
      }
      setSniffingForm(parseSniffingJson(sniffingStr));

      // Raw JSON
      setRawSettingsJson(settingsStr);
      setRawStreamSettingsJson(streamStr);
      setRawSniffingJson(sniffingStr);
    } else {
      // Create new
      setNodeId('');
      setProtocol('vmess');
      setTag('');
      setPort('');
      setListen('0.0.0.0');
      setRemark('');
      setProtocolForm({});
      setTransportForm({ network: 'tcp' });
      setSecurityForm({ security: 'none' });
      setSniffingForm({ enabled: false, destOverride: ['http', 'tls', 'quic', 'fakedns'], metadataOnly: false, routeOnly: true });
      setRawSettingsJson('{}');
      setRawStreamSettingsJson('{}');
      setRawSniffingJson('{}');
      setAdvancedMode(false);
    }
  }, [open, editingInbound]);

  // Toggle advanced mode
  const handleToggleAdvanced = (enabled: boolean) => {
    if (enabled) {
      // Structured → JSON: serialize current form state
      const settingsJson = buildSettingsJson(protocol, protocolForm);
      const transportObj = buildTransportJson(transportForm);
      const securityObj = buildSecurityJson(securityForm);
      const streamSettingsJson = JSON.stringify({ ...transportObj, ...securityObj }, null, 2);
      const sniffingJson = buildSniffingJson(sniffingForm);

      setRawSettingsJson(JSON.stringify(JSON.parse(settingsJson), null, 2));
      setRawStreamSettingsJson(streamSettingsJson);
      setRawSniffingJson(JSON.stringify(JSON.parse(sniffingJson), null, 2));
    } else {
      // JSON → Structured: try to parse
      try {
        setProtocolForm(parseSettingsJson(protocol, rawSettingsJson));
        const streamObj = JSON.parse(rawStreamSettingsJson);
        setTransportForm(parseTransportJson(streamObj));
        setSecurityForm(parseSecurityJson(streamObj));
        setSniffingForm(parseSniffingJson(rawSniffingJson));
      } catch {
        toast.error('JSON 解析失败，无法切换到表单模式');
        return;
      }
    }
    setAdvancedMode(enabled);
  };

  const handleSubmit = () => {
    if (!nodeId || !protocol || !port) {
      toast.error('请填写节点、协议和端口');
      return;
    }

    let settingsJson: string;
    let streamSettingsJson: string;
    let sniffingJson: string;

    if (advancedMode) {
      // Validate raw JSON
      try {
        JSON.parse(rawSettingsJson);
        JSON.parse(rawStreamSettingsJson);
        JSON.parse(rawSniffingJson);
      } catch {
        toast.error('JSON 格式不正确');
        return;
      }
      settingsJson = rawSettingsJson;
      streamSettingsJson = rawStreamSettingsJson;
      sniffingJson = rawSniffingJson;
    } else {
      settingsJson = buildSettingsJson(protocol, protocolForm);
      const transportObj = buildTransportJson(transportForm);
      const securityObj = buildSecurityJson(securityForm);
      streamSettingsJson = JSON.stringify({ ...transportObj, ...securityObj });
      sniffingJson = buildSniffingJson(sniffingForm);
    }

    const data: any = {
      nodeId: parseInt(nodeId),
      protocol,
      tag: tag || undefined,
      port: parseInt(port),
      listen,
      settingsJson,
      streamSettingsJson,
      sniffingJson,
      remark: remark || undefined,
    };

    if (editingInbound) {
      data.id = editingInbound.id;
    }

    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{editingInbound ? '编辑入站' : '创建入站'}</DialogTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">高级模式</Label>
              <Switch checked={advancedMode} onCheckedChange={handleToggleAdvanced} />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">节点 <FieldTip content="选择要部署该入站的远程节点" /></Label>
              <Select value={nodeId} onValueChange={setNodeId}>
                <SelectTrigger><SelectValue placeholder="选择节点" /></SelectTrigger>
                <SelectContent>
                  {nodes.map((n: any) => (
                    <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">协议 <FieldTip content="代理协议类型，不同协议支持的功能和安全性不同" /></Label>
              <Select value={protocol} onValueChange={v => { setProtocol(v); setProtocolForm({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vmess">VMess</SelectItem>
                  <SelectItem value="vless">VLESS</SelectItem>
                  <SelectItem value="trojan">Trojan</SelectItem>
                  <SelectItem value="shadowsocks">Shadowsocks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">Tag <FieldTip content="入站的唯一标识符，用于路由规则引用，留空自动生成" /></Label>
              <Input value={tag} onChange={e => setTag(e.target.value)} placeholder="入站标签" />
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">端口 <FieldTip content="入站监听的端口号，确保该端口未被占用" /></Label>
              <Input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder={portPlaceholder} />
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">监听地址 <FieldTip content="监听的 IP 地址，0.0.0.0 表示监听所有网络接口" /></Label>
              <Input value={listen} onChange={e => setListen(e.target.value)} placeholder="0.0.0.0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1">备注 <FieldTip content="用于标记该入站的说明文字，不影响实际功能" /></Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder="入站备注" />
          </div>

          {/* Structured Mode — sequential sections (3x-ui style) */}
          {!advancedMode && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-muted-foreground whitespace-nowrap">协议设置</h4>
                  <Separator className="flex-1" />
                </div>
                <ProtocolSettings protocol={protocol} value={protocolForm} onChange={setProtocolForm} transportNetwork={transportForm.network} securityType={securityForm.security} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-muted-foreground whitespace-nowrap">传输层设置</h4>
                  <Separator className="flex-1" />
                </div>
                <TransportSettings value={transportForm} onChange={setTransportForm} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-muted-foreground whitespace-nowrap">安全层设置</h4>
                  <Separator className="flex-1" />
                </div>
                <SecuritySettings value={securityForm} onChange={setSecurityForm} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-muted-foreground whitespace-nowrap">嗅探设置</h4>
                  <Separator className="flex-1" />
                </div>
                <SniffingSettings value={sniffingForm} onChange={setSniffingForm} />
              </div>
            </div>
          )}

          {/* Advanced Mode */}
          {advancedMode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Settings JSON</Label>
                <Textarea
                  value={rawSettingsJson}
                  onChange={e => setRawSettingsJson(e.target.value)}
                  placeholder='{"clients": []}'
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Stream Settings JSON</Label>
                <Textarea
                  value={rawStreamSettingsJson}
                  onChange={e => setRawStreamSettingsJson(e.target.value)}
                  placeholder='{"network": "tcp"}'
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Sniffing JSON</Label>
                <Textarea
                  value={rawSniffingJson}
                  onChange={e => setRawSniffingJson(e.target.value)}
                  placeholder='{"enabled": true, "destOverride": ["http", "tls"]}'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? '同步中...' : (editingInbound ? '更新' : '创建')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
