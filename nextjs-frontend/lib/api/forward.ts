import { post } from './client';

export const createForward = (data: any) => post('/forward/create', data);
export const getForwardList = () => post('/forward/list');
export const updateForward = (data: any) => post('/forward/update', data);
export const deleteForward = (id: number) => post('/forward/delete', { id });
export const forceDeleteForward = (id: number) => post('/forward/force-delete', { id });
export const pauseForwardService = (id: number) => post('/forward/pause', { id });
export const resumeForwardService = (id: number) => post('/forward/resume', { id });
export const diagnoseForward = (forwardId: number) => post('/forward/diagnose', { forwardId });
export const updateForwardOrder = (data: { forwards: Array<{ id: number; inx: number }> }) => post('/forward/update-order', data);
