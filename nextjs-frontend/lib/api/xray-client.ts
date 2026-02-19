import { post } from './client';

export const createXrayClient = (data: any) => post('/xray/client/create', data);
export const getXrayClientList = (params?: { inboundId?: number; userId?: number }) => post('/xray/client/list', params || {});
export const updateXrayClient = (data: any) => post('/xray/client/update', data);
export const deleteXrayClient = (id: number) => post('/xray/client/delete', { id });
export const resetXrayClientTraffic = (id: number) => post('/xray/client/reset-traffic', { id });
export const getXrayClientLink = (id: number) => post('/xray/client/link', { id });
