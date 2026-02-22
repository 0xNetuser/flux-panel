'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <Button variant="ghost" size="icon" className="h-8 w-8" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-xs font-medium"
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
    >
      {locale === 'zh' ? 'EN' : '中'}
    </Button>
  );
}
