export interface User {
  id: number;
  user: string;
  roleId: number;
  status: number;
  flow: number;
  inFlow: number;
  outFlow: number;
  num: number;
  expTime: number | null;
  createdTime: number;
  updatedTime: number;
}

export interface Node {
  id: number;
  name: string;
  ip?: string;
  serverIp: string;
  portSta: number;
  portEnd: number;
  status: number;
  http: number;
  tls: number;
  socks: number;
  xrayEnabled: number;
  xrayVersion: string | null;
  xrayStatus: number;
  version: string;
  uptime?: number;
  cpuUsage?: number;
  memUsage?: number;
  bytesReceived?: number;
  bytesTransmitted?: number;
  createdTime: number;
  updatedTime: number;
}

export interface Tunnel {
  id: number;
  name: string;
  inNodeId: number;
  outNodeId: number | null;
  inIp: string;
  outIp: string | null;
  type: number;
  protocol: string;
  portSta: number;
  portEnd: number;
  status: number;
  interfaceName: string | null;
  createdTime: number;
  updatedTime: number;
}

export interface Forward {
  id: number;
  userId: number;
  name: string;
  tunnelId: number;
  inPort: number;
  outPort: number | null;
  remoteAddr: string;
  status: number;
  userName: string;
  inFlow: number;
  outFlow: number;
  strategy: string;
  inx: number;
  interfaceName: string | null;
  tunnelName: string;
  inIp: string;
  outIp: string | null;
  tunnelType: number;
  protocol: string;
  createdTime: number;
  updatedTime: number;
}

export interface SpeedLimit {
  id: number;
  name: string;
  speed: number;
  createdTime: number;
  updatedTime: number;
}
