import { post } from './client';

export const createTunnel = (data: any) => post('/tunnel/create', data);
export const getTunnelList = () => post('/tunnel/list');
export const getTunnelById = (id: number) => post('/tunnel/get', { id });
export const updateTunnel = (data: any) => post('/tunnel/update', data);
export const deleteTunnel = (id: number) => post('/tunnel/delete', { id });
export const diagnoseTunnel = (tunnelId: number) => post('/tunnel/diagnose', { tunnelId });

// User-tunnel assignments
export const assignUserTunnel = (data: any) => post('/tunnel/user/assign', data);
export const getUserTunnelList = (queryData: any = {}) => post('/tunnel/user/list', queryData);
export const removeUserTunnel = (params: any) => post('/tunnel/user/remove', params);
export const updateUserTunnel = (data: any) => post('/tunnel/user/update', data);
export const userTunnel = () => post('/tunnel/user/tunnel');
