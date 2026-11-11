export type RouteTargetType = 'cloud-run' | 'static-gcs';

export interface ProxyRoute {
  slug: string;
  type: RouteTargetType;
  target: string;
  containerId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface RegisterRouteInput {
  slug: string;
  type?: RouteTargetType;
  target: string;
  containerId?: string;
}

export interface ProxyServerConfig {
  port: number;
  host: string;
  defaultBucket?: string;
}
