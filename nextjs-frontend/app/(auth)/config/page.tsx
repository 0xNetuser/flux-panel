'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getConfigs, updateConfigs } from '@/lib/api/config';
import { useAuth } from '@/lib/hooks/use-auth';

export default function ConfigPage() {
  const { isAdmin } = useAuth();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const configLabels: Record<string, string> = {
    'site_name': '站点名称',
    'site_desc': '站点描述',
    'panel_addr': '面板地址',
    'sub_domain': '订阅域名',
    'tg_bot_token': 'Telegram Bot Token',
    'tg_admin_id': 'Telegram 管理员ID',
    'reg_enable': '开放注册',
    'captcha_enabled': '验证码开关',
    'app_name': '应用名称',
  };

  const getConfigLabel = (key: string) => {
    return configLabels[key] || key;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">无权限访问</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">网站配置</h2>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          保存配置
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">系统配置</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : Object.keys(configs).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无配置项</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(configs).map(([key, value]) => (
                <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <Label className="md:text-right font-medium">{getConfigLabel(key)}</Label>
                  <div className="md:col-span-2">
                    <Input
                      value={value}
                      onChange={e => handleChange(key, e.target.value)}
                      placeholder={`请输入 ${getConfigLabel(key)}`}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{key}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
