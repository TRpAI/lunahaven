import { LedgerFullData, OneDriveConfig } from '../types';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface OneDriveBackupFile {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  webUrl?: string;
}

export interface OneDriveUserProfile {
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
  quota?: {
    total: number;
    used: number;
    remaining: number;
  };
}

/**
 * 获取 OneDrive 用户与存储空间信息
 */
export async function getOneDriveUserInfo(accessToken: string): Promise<OneDriveUserProfile> {
  const token = accessToken.trim();
  if (!token) throw new Error('未提供有效的 OneDrive 访问令牌 (Access Token)');

  const [userRes, driveRes] = await Promise.all([
    fetch(`${GRAPH_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${GRAPH_BASE_URL}/me/drive`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!userRes.ok) {
    const errJson = await userRes.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `验证微软账户失败 (HTTP ${userRes.status})`);
  }

  const userData = await userRes.json();
  let quota = undefined;

  if (driveRes.ok) {
    const driveData = await driveRes.json();
    if (driveData?.quota) {
      quota = {
        total: driveData.quota.total || 0,
        used: driveData.quota.used || 0,
        remaining: driveData.quota.remaining || 0,
      };
    }
  }

  return {
    displayName: userData.displayName || 'Microsoft User',
    mail: userData.mail || userData.userPrincipalName || '',
    userPrincipalName: userData.userPrincipalName || '',
    quota,
  };
}

/**
 * 向 OneDrive 指定目录上传增量/全量备份快照
 */
export async function uploadBackupToOneDrive(
  accessToken: string,
  folderName: string,
  data: LedgerFullData,
  maxRetention: number = 20
): Promise<{ fileName: string; size: number; backupTime: string }> {
  const token = accessToken.trim();
  if (!token) throw new Error('未连接 OneDrive 或 Token 已失效');

  const cleanFolder = folderName.trim().replace(/^\/+|\/+$/g, '') || 'QiyueLedger';
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const revision = data.syncMeta?.revision || 1;
  const fileName = `qiyue_ledger_backup_${dateStr}_rev${revision}.json`;

  const payload = JSON.stringify(
    {
      format: 'qiyue-ledger',
      version: 2,
      exportedAt: now.toISOString(),
      syncMeta: data.syncMeta,
      data: {
        salaries: data.salaries,
        overtimes: data.overtimes,
        expenses: data.expenses || [],
        gifts: data.gifts,
        vehicles: data.vehicles,
        fuels: data.fuels,
        maintenances: data.maintenances,
        settings: data.settings,
        syncMeta: data.syncMeta,
      },
    },
    null,
    2
  );

  // 按照 Microsoft Graph 标准路径规则：目录与文件名分别编码，中间用标准 '/' 分隔
  const targetPath = `${encodeURIComponent(cleanFolder)}/${encodeURIComponent(fileName)}`;
  const uploadUrl = `${GRAPH_BASE_URL}/me/drive/root:/${targetPath}:/content`;

  // 1. 上传时间戳快照文件
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: payload,
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `备份上传失败 (HTTP ${res.status})`);
  }

  // 2. 同时更新 latest_backup.json 便于快速恢复最新状态
  try {
    const latestPath = `${encodeURIComponent(cleanFolder)}/latest_backup.json`;
    await fetch(`${GRAPH_BASE_URL}/me/drive/root:/${latestPath}:/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    });
  } catch (err) {
    console.warn('Failed to update latest_backup.json on OneDrive', err);
  }

  // 3. 执行生命周期保留策略：自动清理超过 maxRetention 数量的最早历史备份
  try {
    await pruneOldOneDriveBackups(token, cleanFolder, maxRetention);
  } catch (err) {
    console.warn('Auto pruning old backups failed:', err);
  }

  return {
    fileName,
    size: new Blob([payload]).size,
    backupTime: now.toLocaleString('zh-CN'),
  };
}

/**
 * 获取 OneDrive 备份文件列表
 */
export async function listOneDriveBackups(
  accessToken: string,
  folderName: string
): Promise<OneDriveBackupFile[]> {
  const token = accessToken.trim();
  if (!token) throw new Error('未提供有效 Access Token');

  const cleanFolder = folderName.trim().replace(/^\/+|\/+$/g, '') || 'QiyueLedger';
  const listUrl = `${GRAPH_BASE_URL}/me/drive/root:/${encodeURIComponent(cleanFolder)}:/children?$top=100`;

  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    return []; // 文件夹尚未创建
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `获取文件列表失败 (HTTP ${res.status})`);
  }

  const json = await res.json();
  const items: any[] = json.value || [];

  return items
    .filter((item) => item.name?.endsWith('.json') && !item.folder)
    .map((item) => ({
      id: item.id,
      name: item.name,
      size: item.size || 0,
      lastModifiedDateTime: item.lastModifiedDateTime || item.createdDateTime,
      webUrl: item.webUrl,
    }))
    .sort((a, b) => new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime());
}

/**
 * 从 OneDrive 下载并解析备份文件
 */
export async function downloadBackupFromOneDrive(
  accessToken: string,
  fileId: string
): Promise<LedgerFullData> {
  const token = accessToken.trim();
  if (!token) throw new Error('未提供有效 Access Token');

  const downloadUrl = `${GRAPH_BASE_URL}/me/drive/items/${fileId}/content`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `下载备份数据失败 (HTTP ${res.status})`);
  }

  const parsed = await res.json();

  if (parsed.format === 'qiyue-ledger' && parsed.data) {
    const d = parsed.data;
    return {
      salaries: d.salaries || [],
      overtimes: d.overtimes || [],
      expenses: d.expenses || [],
      gifts: d.gifts || [],
      vehicles: d.vehicles || [],
      fuels: d.fuels || [],
      maintenances: d.maintenances || [],
      settings: d.settings || {},
      syncMeta: d.syncMeta,
      version: parsed.version || '2.0.0',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
    };
  }

  // 直接全量格式
  return {
    salaries: parsed.salaries || [],
    overtimes: parsed.overtimes || [],
    expenses: parsed.expenses || [],
    gifts: parsed.gifts || [],
    vehicles: parsed.vehicles || [],
    fuels: parsed.fuels || [],
    maintenances: parsed.maintenances || [],
    settings: parsed.settings || {},
    syncMeta: parsed.syncMeta,
    version: parsed.version || '2.0.0',
    exportedAt: parsed.exportedAt || new Date().toISOString(),
  };
}

/**
 * 自动清理超出最大保留数的历史备份
 */
async function pruneOldOneDriveBackups(
  accessToken: string,
  folderName: string,
  maxRetention: number
) {
  if (maxRetention <= 0) return;
  const backups = await listOneDriveBackups(accessToken, folderName);
  const timestampBackups = backups.filter((b) => b.name.startsWith('qiyue_ledger_backup_'));

  if (timestampBackups.length > maxRetention) {
    const toDelete = timestampBackups.slice(maxRetention);
    for (const file of toDelete) {
      try {
        await fetch(`${GRAPH_BASE_URL}/me/drive/items/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (err) {
        console.warn(`Failed to delete old backup ${file.name}:`, err);
      }
    }
  }
}

/**
 * 格式化字节大小显示
 */
export function formatByteSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
