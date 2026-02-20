import { post } from './client';

export const getNodeHealth = () => post('/monitor/node-health', {});
export const getLatencyHistory = (forwardId: number, hours: number) =>
  post('/monitor/latency-history', { forwardId, hours });
export const getForwardFlowHistory = (forwardId: number, hours: number) =>
  post('/monitor/forward-flow', { forwardId, hours });
export const getTrafficOverview = (granularity: string, hours: number) =>
  post('/monitor/traffic-overview', { granularity, hours });
