import { post } from './client';

export const createNode = (data: any) => post('/node/create', data);
export const getNodeList = () => post('/node/list');
export const updateNode = (data: any) => post('/node/update', data);
export const deleteNode = (id: number) => post('/node/delete', { id });
export const getNodeInstallCommand = (id: number) => post('/node/install', { id, panelAddr: window.location.origin });
export const getNodeDockerCommand = (id: number) => post('/node/install/docker', { id, panelAddr: window.location.origin });
export const getAccessibleNodeList = (options?: { xrayOnly?: boolean; gostOnly?: boolean }) =>
  post('/node/accessible', {
    ...(options?.xrayOnly ? { xrayOnly: true } : {}),
    ...(options?.gostOnly ? { gostOnly: true } : {}),
  });
export const checkNodeStatus = (nodeId?: number) => post('/node/check-status', nodeId ? { nodeId } : {});
export const reconcileNode = (id: number) => post('/node/reconcile', { id });
export const updateNodeBinary = (id: number) => post('/node/update-binary', { id });
export const updateNodeOrder = (items: { id: number; inx: number }[]) => post('/node/update-order', { items });
export const setNodeProtocol = (data: { id: number; http: number; tls: number; socks: number }) => post('/node/set-protocol', data);
