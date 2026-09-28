export interface GatewayQuery {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface GatewayPage<T> {
  items: T[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface EntityGateway<T> {
  list(query?: GatewayQuery): Promise<GatewayPage<T>>;
  getById(id: string): Promise<T | null>;
}

export interface GatewayFailure {
  code: string;
  message: string;
  cause?: unknown;
}
