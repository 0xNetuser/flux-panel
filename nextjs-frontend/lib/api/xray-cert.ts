import { post } from './client';

export const createXrayCert = (data: any) => post('/xray/cert/create', data);
export const getXrayCertList = (nodeId?: number) => post('/xray/cert/list', nodeId ? { nodeId } : {});
export const deleteXrayCert = (id: number) => post('/xray/cert/delete', { id });
export const issueXrayCert = (id: number) => post('/xray/cert/issue', { id });
export const renewXrayCert = (id: number) => post('/xray/cert/renew', { id });
