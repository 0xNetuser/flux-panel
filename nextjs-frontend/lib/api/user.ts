import { post } from './client';

export const createUser = (data: any) => post('/user/create', data);
export const getAllUsers = (pageData: any = {}) => post('/user/list', pageData);
export const updateUser = (data: any) => post('/user/update', data);
export const deleteUser = (id: number) => post('/user/delete', { id });
export const getUserPackageInfo = () => post('/user/package');
export const resetUserFlow = (data: { id: number; type: number }) => post('/user/reset', data);
