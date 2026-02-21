'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Eye, EyeOff, RefreshCw, CheckCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getConfigs, updateConfigs } from '@/lib/api/config';
import { forceCheckUpdate, UpdateInfo } from '@/lib/api/system';
import { useAuth } from '@/lib/hooks/use-auth';

interface ConfigFieldDef {
  label: string;
  description: string;
  type: 'text' | 'switch' | 'password' | 'number';
  suffix?: string;
}

const configFields: Record<string, ConfigFieldDef> = {
  app_name: { label: '应用名称', description: '应用名称，显示在登录页和浏览器标题', type: 'text' },
  site_name: { label: '站点名称', description: '站点名称', type: 'text' },
  site_desc: { label: '站点描述', description: '站点描述信息', type: 'text' },
  panel_addr: { label: '面板地址', description: '面板对外访问地址，用于生成节点安装命令，例如 http://your-domain.com:8080', type: 'text' },
  sub_domain: { label: '订阅域名', description: '订阅链接使用的域名', type: 'text' },
  tg_bot_token: { label: 'Telegram Bot Token', description: 'Telegram Bot 的 API Token，用于接收通知', type: 'password' },
  tg_admin_id: { label: 'Telegram 管理员ID', description: '接收通知的 Telegram 用户 ID', type: 'text' },
  reg_enable: { label: '开放注册', description: '开启后允许新用户自行注册', type: 'switch' },
  captcha_enabled: { label: '验证码开关', description: '开启后登录和注册页面需要完成验证码', type: 'switch' },
  monitor_interval: { label: '延迟监控频率', description: '延迟监控的检测间隔，最小 10 秒', type: 'number', suffix: '秒' },
  monitor_retention_days: { label: '监控数据保留天数', description: '监控数据（延迟、流量快照）保留的天数', type: 'number', suffix: '天' },
};

const groups: { title: string; keys: string[] }[] = [
  { title: '基本信息', keys: ['app_name', 'site_name', 'site_desc'] },
  { title: '订阅与通知', keys: ['panel_addr', 'sub_domain', 'tg_bot_token', 'tg_admin_id'] },
  { title: '安全与监控', keys: ['reg_enable', 'captcha_enabled', 'monitor_interval', 'monitor_retention_days'] },
];

function getFieldDef(key: string): ConfigFieldDef {
  return configFields[key] || { label: key, description: '', type: 'text' };
}

function ConfigField({ configKey, value, onChange }: { configKey: string; value: string; onChange: (key: string, value: string) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const field = getFieldDef(configKey);

  if (field.type === 'switch') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <Label className="md:text-right font-medium pt-0.5">{field.label}</Label>
        <div className="md:col-span-2 space-y-1">
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(configKey, checked ? 'true' : 'false')}
          />
          {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        </div>
      </div>
    );
  }

  if (field.type === 'password') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <Label className="md:text-right font-medium pt-2">{field.label}</Label>
        <div className="md:col-span-2 space-y-1">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={value}
              onChange={e => onChange(configKey, e.target.value)}
              placeholder={`请输入 ${field.label}`}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(prev => !prev)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        </div>
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <Label className="md:text-right font-medium pt-2">{field.label}</Label>
        <div className="md:col-span-2 space-y-1">
          <div className="relative">
            <Input
              type="number"
              value={value}
              onChange={e => onChange(configKey, e.target.value)}
              placeholder={`请输入 ${field.label}`}
              className={field.suffix ? 'pr-10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]' : ''}
            />
            {field.suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                {field.suffix}
              </span>
            )}
          </div>
          {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        </div>
      </div>
    );
  }

  // Default text input
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      <Label className="md:text-right font-medium pt-2">{field.label}</Label>
      <div className="md:col-span-2 space-y-1">
        <Input
          value={value}
          onChange={e => onChange(configKey, e.target.value)}
          placeholder={`请输入 ${field.label}`}
        />
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const { isAdmin } = useAuth();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getConfigs();
    if (res.code === 0 && res.data) {
      if (Array.isArray(res.data)) {
        const configMap: Record<string, string> = {};
        res.data.forEach((item: any) => {
          configMap[item.name || item.key] = item.value || '';
        });
        setConfigs(configMap);
      } else if (typeof res.data === 'object') {
        setConfigs(res.data as Record<string, string>);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await updateConfigs(configs);
    if (res.code === 0) {
      toast.success('配置已保存');
    } else {
      toast.error(res.msg || '保存失败');
    }
    setSaving(false);
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const res = await forceCheckUpdate();
      if (res.code === 0 && res.data) {
        setUpdateInfo(res.data);
        if (res.data.hasUpdate) {
          toast.success(`发现新版本 ${res.data.latest}`);
        } else {
          toast.success('已是最新版本');
        }
      } else {
        toast.error(res.msg || '检查更新失败');
      }
    } catch {
      toast.error('检查更新失败');
    } finally {
      setChecking(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问</p>
      </div>
    );
  }

  // Collect all known keys from groups
  const knownKeys = new Set(groups.flatMap(g => g.keys));
  // Find keys present in configs but not in any group
  const otherKeys = Object.keys(configs).filter(k => !knownKeys.has(k));

  const renderGroup = (title: string, keys: string[]) => {
    const activeKeys = keys.filter(k => k in configs);
    if (activeKeys.length === 0) return null;
    return (
      <Card key={title}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeKeys.map(key => (
              <ConfigField key={key} configKey={key} value={configs[key]} onChange={handleChange} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">系统配置</h2>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          保存配置
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">版本更新</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleCheckUpdate} disabled={checking}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              检查更新
            </Button>
            {updateInfo && (
              <div className="flex items-center gap-2 text-sm">
                {updateInfo.hasUpdate ? (
                  <>
                    <ArrowUpCircle className="h-4 w-4 text-orange-500" />
                    <span>当前 {updateInfo.current}，最新 <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{updateInfo.latest}</a></span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">当前 {updateInfo.current}，已是最新版本</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          </CardContent>
        </Card>
      ) : Object.keys(configs).length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">暂无配置项</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {groups.map(g => renderGroup(g.title, g.keys))}
          {otherKeys.length > 0 && renderGroup('其他', otherKeys)}
        </>
      )}
    </div>
  );
}
