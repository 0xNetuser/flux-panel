export interface XrayInbound {
  id: number;
  nodeId: number;
  tag: string;
  protocol: string;
  listen: string;
  port: number;
  settingsJson: string;
  streamSettingsJson: string | null;
  sniffingJson: string | null;
  remark: string | null;
  enable: number;
  createdTime: number;
  updatedTime: number;
}

export interface XrayClient {
  id: number;
  inboundId: number;
  userId: number;
  email: string;
  uuidOrPassword: string;
  flow: string | null;
  alterId: number;
  totalTraffic: number;
  upTraffic: number;
  downTraffic: number;
  expTime: number | null;
  enable: number;
  remark: string | null;
  createdTime: number;
  updatedTime: number;
}

export interface XrayTlsCert {
  id: number;
  nodeId: number;
  domain: string;
  publicKey: string;
  privateKey: string;
  autoRenew: number;
  expireTime: number | null;
  createdTime: number;
  updatedTime: number;
}

export type XrayProtocol = 'vmess' | 'vless' | 'trojan' | 'shadowsocks';
export type XrayNetwork = 'tcp' | 'ws' | 'grpc' | 'h2';
export type XraySecurity = 'none' | 'tls' | 'reality';
