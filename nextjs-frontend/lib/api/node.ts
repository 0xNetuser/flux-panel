import { post } from './client';

export const createNode = (data: any) => post('/node/create', data);
export const getNodeList = () => post('/node/list');
export const updateNode = (data: any) => post('/node/update', data);
export const deleteNode = (id: number) => post('/node/delete', { id });
export const getNodeInstallCommand = (id: number) => post('/node/install', { id, panelAddr: window.location.origin });
export const getNodeDockerCommand = (id: number) => post('/node/install/docker', { id, panelAddr: window.location.origin });
export const getAccessibleNodeList = () => post('/node/accessible');
export const checkNodeStatus = (nodeId?: number) => post('/node/check-status', nodeId ? { nodeId } : {});
