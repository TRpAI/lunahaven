/**
 * Cloudflare Worker D1 Types for Qiyue Ledger (Production)
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[]; success: boolean; error?: string }>;
  run(): Promise<{ success: boolean; error?: string; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<any[]>;
  exec(query: string): Promise<any>;
}

export interface Env {
  DB: D1Database;
  API_TOKEN?: string;
  AUTH_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
}

export interface SyncPayload {
  format?: string;
  version?: number;
  expectedRevision?: number;
  salaries?: any[];
  overtimes?: any[];
  expenses?: any[];
  gifts?: any[];
  vehicles?: any[];
  fuels?: any[];
  maintenances?: any[];
  settings?: any;
  syncMeta?: {
    revision?: number;
    schemaVersion?: number;
    lastSyncedAt?: string;
  };
}

export interface SyncResponseData {
  salaries: any[];
  overtimes: any[];
  expenses: any[];
  gifts: any[];
  vehicles: any[];
  fuels: any[];
  maintenances: any[];
  settings: any[];
  syncMeta: any;
}
