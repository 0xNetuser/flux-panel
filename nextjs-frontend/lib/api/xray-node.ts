import { post, get } from './client';

export const startXray = (nodeId: number) => post('/xray/node/start', { nodeId });
export const stopXray = (nodeId: number) => post('/xray/node/stop', { nodeId });
export const restartXray = (nodeId: number) => post('/xray/node/restart', { nodeId });
export const getXrayStatus = (nodeId: number) => post('/xray/node/status', { nodeId });
export const switchXrayVersion = (nodeId: number, version: string) => post('/xray/node/switch-version', { nodeId, version });
export const getXrayVersions = () => get('/xray/node/versions');
