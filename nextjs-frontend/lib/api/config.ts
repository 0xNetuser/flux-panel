import { post } from './client';

export const getConfigs = () => post('/config/list');
export const getConfigByName = (name: string) => post('/config/get', { name });
export const updateConfigs = (configMap: Record<string, string>) => post('/config/update', configMap);
export const updateConfig = (name: string, value: string) => post('/config/update-single', { name, value });

export const getSpeedLimitList = () => post('/speed-limit/list');
export const createSpeedLimit = (data: any) => post('/speed-limit/create', data);
export const updateSpeedLimit = (data: any) => post('/speed-limit/update', data);
export const deleteSpeedLimit = (id: number) => post('/speed-limit/delete', { id });
