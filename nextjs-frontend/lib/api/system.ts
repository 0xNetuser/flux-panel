import { get, post } from './client';

export async function getVersion(): Promise<string> {
  const res = await get<{ version: string }>('version');
  return res.code === 0 ? res.data.version : '';
}

export async function getDashboardStats() {
  return post('dashboard/stats');
}

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  releaseUrl: string;
}

export async function checkUpdate() {
  return post<UpdateInfo>('system/check-update');
}

export async function selfUpdate() {
  return post('system/update', {});
}
