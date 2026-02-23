'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getConfigs } from './api/config';

interface SiteConfig {
  siteName: string;
  siteDesc: string;
  appName: string;
  refreshSiteConfig: () => Promise<void>;
}

const defaultSiteName = 'Flux Panel';

const SiteConfigContext = createContext<SiteConfig>({
  siteName: defaultSiteName,
  siteDesc: '',
  appName: '',
  refreshSiteConfig: async () => {},
});

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [siteName, setSiteName] = useState(defaultSiteName);
  const [siteDesc, setSiteDesc] = useState('');
  const [appName, setAppName] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await getConfigs();
      if (res.code === 0 && res.data) {
        let map: Record<string, string> = {};
        if (Array.isArray(res.data)) {
          res.data.forEach((item: any) => {
            map[item.name || item.key] = item.value || '';
          });
        } else if (typeof res.data === 'object') {
          map = res.data as Record<string, string>;
        }
        setSiteName(map['site_name'] || defaultSiteName);
        setSiteDesc(map['site_desc'] || '');
        setAppName(map['app_name'] || '');
      }
    } catch {
      // ignore — keep defaults
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  useEffect(() => {
    if (siteDesc) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (meta) {
        meta.content = siteDesc;
      } else {
        meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = siteDesc;
        document.head.appendChild(meta);
      }
    }
  }, [siteDesc]);

  return (
    <SiteConfigContext.Provider value={{ siteName, siteDesc, appName, refreshSiteConfig: refresh }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
