import { post } from './client';

export const createXrayInbound = (data: any) => post('/xray/inbound/create', data);
export const getXrayInboundList = (nodeId?: number) => post('/xray/inbound/list', nodeId ? { nodeId } : {});
export const updateXrayInbound = (data: any) => post('/xray/inbound/update', data);
export const deleteXrayInbound = (id: number) => post('/xray/inbound/delete', { id });
export const enableXrayInbound = (id: number) => post('/xray/inbound/enable', { id });
export const disableXrayInbound = (id: number) => post('/xray/inbound/disable', { id });
