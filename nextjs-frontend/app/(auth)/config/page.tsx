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
import { forceCheckUpdate, selfUpdate, UpdateInfo } from '@/lib/api/system';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

interface ConfigFieldDef {
  label: string;
  description: string;
  type: 'text' | 'switch' | 'password' | 'number';
  suffix?: string;
}

function ConfigField({ configKey, value, onChange }: { configKey: string; value: string; onChange: (key: string, value: string) => void }) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const configFields: Record<string, ConfigFieldDef> = {
    app_name: { label: t('config.appName'), description: t('config.appNameDesc'), type: 'text' },
    site_name: { label: t('config.siteName'), description: t('config.siteNameDesc'), type: 'text' },
    site_desc: { label: t('config.siteDesc'), description: t('config.siteDescDesc'), type: 'text' },
    panel_addr: { label: t('config.panelAddr'), description: t('config.panelAddrDesc'), type: 'text' },
    captcha_enabled: { label: t('config.captchaEnabled'), description: t('config.captchaEnabledDesc'), type: 'switch' },
    monitor_interval: { label: t('config.monitorInterval'), description: t('config.monitorIntervalDesc'), type: 'number', suffix: t('config.seconds') },
    monitor_retention_days: { label: t('config.monitorRetentionDays'), description: t('config.monitorRetentionDaysDesc'), type: 'number', suffix: t('config.days') },
  };

  function getFieldDef(key: string): ConfigFieldDef {
    return configFields[key] || { label: key, description: '', type: 'text' };
  }

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
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const configFieldKeys = ['app_name', 'site_name', 'site_desc', 'panel_addr', 'captcha_enabled', 'monitor_interval', 'monitor_retention_days'];

  const groups: { titleKey: string; keys: string[] }[] = [
    { titleKey: 'config.basicInfo', keys: ['app_name', 'site_name', 'site_desc', 'panel_addr'] },
    { titleKey: 'config.securityAndMonitor', keys: ['captcha_enabled', 'monitor_interval', 'monitor_retention_days'] },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getConfigs();
    if (res.code === 0 && res.data) {
      let configMap: Record<string, string> = {};
      if (Array.isArray(res.data)) {
        res.data.forEach((item: any) => {
          configMap[item.name || item.key] = item.value || '';
        });
      } else if (typeof res.data === 'object') {
        configMap = { ...(res.data as Record<string, string>) };
      }
      // Ensure all defined config fields exist so they are always visible
      for (const key of configFieldKeys) {
        if (!(key in configMap)) {
          configMap[key] = '';
        }
      }
      setConfigs(configMap);
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
      toast.success(t('config.configSaved'));
    } else {
      toast.error(res.msg || t('config.saveFailed'));
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
          toast.success(t('config.newVersionFound', { version: res.data.latest }));
        } else {
          toast.success(t('config.alreadyLatest'));
        }
      } else {
        toast.error(res.msg || t('config.checkUpdateFailed'));
      }
    } catch {
      toast.error(t('config.checkUpdateFailed'));
    } finally {
      setChecking(false);
    }
  };

  const handleSelfUpdate = async () => {
    if (!confirm(t('config.confirmUpdate'))) return;
    setUpdating(true);
    try {
      const res = await selfUpdate();
      if (res.code === 0) {
        toast.success(t('config.updateStarted'));
      } else {
        toast.error(res.msg || t('config.updateFailed'));
      }
    } catch {
      toast.error(t('config.updateFailed'));
    } finally {
      setUpdating(false);
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
        <h2 className="text-2xl font-bold">{t('config.title')}</h2>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? t('config.saving') : t('config.saveConfig')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('config.versionUpdate')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleCheckUpdate} disabled={checking}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {checking ? t('config.checking') : t('config.checkUpdate')}
            </Button>
            {updateInfo && (
              <div className="flex items-center gap-2 text-sm">
                {updateInfo.hasUpdate ? (
                  <>
                    <ArrowUpCircle className="h-4 w-4 text-orange-500" />
                    <span>{t('config.current')} {updateInfo.current}，{t('config.latest')} <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{updateInfo.latest}</a></span>
                    <Button size="sm" variant="outline" onClick={handleSelfUpdate} disabled={updating}
                      className="ml-2 text-orange-600 border-orange-500/50 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950/40">
                      {updating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                      {updating ? t('config.updating') : t('config.oneClickUpdate')}
                    </Button>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">{t('config.current')} {updateInfo.current}，{t('config.alreadyLatest')}</span>
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
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          </CardContent>
        </Card>
      ) : Object.keys(configs).length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">{t('config.noConfig')}</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {groups.map(g => renderGroup(t(g.titleKey), g.keys))}
          {otherKeys.length > 0 && renderGroup(t('config.other'), otherKeys)}
        </>
      )}
    </div>
  );
}
