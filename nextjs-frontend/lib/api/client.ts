import axios, { AxiosResponse } from 'axios';

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
  ts?: number;
}

const baseURL = process.env.NEXT_PUBLIC_API_BASE
  ? `${process.env.NEXT_PUBLIC_API_BASE}/api/v1/`
  : '/api/v1/';

const client = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = token;
    }
  }
  return config;
});

// Response interceptor: handle 401
client.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const data = response.data;
    if (data && data.code === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('role_id');
        localStorage.removeItem('name');
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('role_id');
        localStorage.removeItem('name');
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function post<T = any>(path: string, data: any = {}): Promise<ApiResponse<T>> {
  try {
    const response = await client.post<ApiResponse<T>>(path, data);
    return response.data;
  } catch (error: any) {
    return { code: -1, msg: error.message || '网络请求失败', data: null as T };
  }
}

export async function get<T = any>(path: string, params: any = {}): Promise<ApiResponse<T>> {
  try {
    const response = await client.get<ApiResponse<T>>(path, { params });
    return response.data;
  } catch (error: any) {
    return { code: -1, msg: error.message || '网络请求失败', data: null as T };
  }
}

export default client;
