import os from 'os';
import { monitorEventLoopDelay } from 'perf_hooks';
import {
  isExternalSupabaseConfigured,
  rawSupabaseAdmin,
  supabaseProjectInfo,
} from '../config/supabase';

interface RequestSample {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

interface RouteAggregate {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
}

const MAX_SAMPLES = 500;
const SLOW_THRESHOLD_MS = 500;

class MonitoringService {
  private samples: RequestSample[] = [];
  private routeStats: Map<string, RouteAggregate> = new Map();
  private totalRequests = 0;
  private totalErrors = 0;
  private slowRequests = 0;
  private startedAt = Date.now();
  private eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });

  constructor() {
    try {
      this.eventLoopMonitor.enable();
    } catch {
      // Non-fatal in constrained test environments
    }
  }

  recordRequest(method: string, path: string, statusCode: number, durationMs: number) {
    const cleanPath = (path || '/').split('?')[0];
    const normalizedDuration = Math.max(0, Number(durationMs.toFixed(2)));

    this.totalRequests += 1;
    if (statusCode >= 500) {
      this.totalErrors += 1;
    }
    if (normalizedDuration >= SLOW_THRESHOLD_MS) {
      this.slowRequests += 1;
    }

    this.samples.push({
      method,
      path: cleanPath,
      statusCode,
      durationMs: normalizedDuration,
      timestamp: Date.now(),
    });

    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift();
    }

    const key = `${method} ${cleanPath}`;
    const existing = this.routeStats.get(key) || {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      lastStatus: statusCode,
    };

    existing.count += 1;
    if (statusCode >= 400) existing.errorCount += 1;
    existing.totalDurationMs += normalizedDuration;
    existing.maxDurationMs = Math.max(existing.maxDurationMs, normalizedDuration);
    existing.lastStatus = statusCode;
    this.routeStats.set(key, existing);

    // Keep route map bounded
    if (this.routeStats.size > 250) {
      const oldestKey = this.routeStats.keys().next().value;
      if (oldestKey) this.routeStats.delete(oldestKey);
    }
  }

  getSystemMetrics() {
    const loadAvg = os.loadavg();
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const procMem = process.memoryUsage();
    const cpuCount = Math.max(1, os.cpus()?.length || 1);
    const load1m = Number((loadAvg[0] || 0).toFixed(2));
    const cpuUtilizationEstimate = Math.min(100, Math.round((load1m / cpuCount) * 100));

    let eventLoopLagMs = 0;
    try {
      const meanNs = this.eventLoopMonitor.mean;
      if (Number.isFinite(meanNs) && meanNs > 0) {
        eventLoopLagMs = Number((meanNs / 1e6).toFixed(2));
      }
    } catch {
      eventLoopLagMs = 0;
    }

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: new Date(this.startedAt).toISOString(),
      cpuCount,
      loadAverage: {
        '1m': load1m,
        '5m': Number((loadAvg[1] || 0).toFixed(2)),
        '15m': Number((loadAvg[2] || 0).toFixed(2)),
      },
      cpuUtilizationPercent: cpuUtilizationEstimate,
      eventLoopLagMs,
      memory: {
        rssBytes: procMem.rss,
        heapUsedBytes: procMem.heapUsed,
        heapTotalBytes: procMem.heapTotal,
        externalBytes: procMem.external,
        systemTotalBytes: totalMemBytes,
        systemFreeBytes: freeMemBytes,
        systemUsedPercent: totalMemBytes > 0
          ? Number((((totalMemBytes - freeMemBytes) / totalMemBytes) * 100).toFixed(1))
          : 0,
      },
    };
  }

  getApiMetrics() {
    const durations = this.samples.map((s) => s.durationMs).sort((a, b) => a - b);
    const sampleCount = durations.length;

    const avgLatencyMs = sampleCount > 0
      ? Number((durations.reduce((acc, v) => acc + v, 0) / sampleCount).toFixed(2))
      : 0;

    const p95Index = sampleCount > 0 ? Math.min(sampleCount - 1, Math.floor(sampleCount * 0.95)) : 0;
    const p95LatencyMs = sampleCount > 0 ? Number(durations[p95Index].toFixed(2)) : 0;
    const maxLatencyMs = sampleCount > 0 ? Number(durations[sampleCount - 1].toFixed(2)) : 0;

    const errorRatePercent = this.totalRequests > 0
      ? Number(((this.totalErrors / this.totalRequests) * 100).toFixed(2))
      : 0;

    const topRoutes = Array.from(this.routeStats.entries())
      .map(([route, stats]) => ({
        route,
        count: stats.count,
        errorCount: stats.errorCount,
        avgLatencyMs: Number((stats.totalDurationMs / Math.max(1, stats.count)).toFixed(2)),
        maxLatencyMs: stats.maxDurationMs,
        lastStatus: stats.lastStatus,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const recentSlowRequests = this.samples
      .filter((s) => s.durationMs >= SLOW_THRESHOLD_MS)
      .slice(-10)
      .reverse();

    return {
      totalRequests: this.totalRequests,
      totalServerErrors: this.totalErrors,
      errorRatePercent,
      slowRequestsCount: this.slowRequests,
      slowThresholdMs: SLOW_THRESHOLD_MS,
      avgLatencyMs,
      p95LatencyMs,
      maxLatencyMs,
      windowSampleSize: sampleCount,
      topRoutes,
      recentSlowRequests,
    };
  }

  async checkSupabaseHealth(): Promise<{
    configured: boolean;
    connected: boolean;
    projectId: string;
    url: string;
    latencyMs: number | null;
    tables: Record<string, { ok: boolean; count: number | null; error?: string }>;
    storage: { ok: boolean; buckets: string[]; error?: string };
    error?: string;
  }> {
    const configured = isExternalSupabaseConfigured();
    if (!configured || !rawSupabaseAdmin) {
      return {
        configured: false,
        connected: false,
        projectId: supabaseProjectInfo.projectId,
        url: supabaseProjectInfo.url,
        latencyMs: null,
        tables: {},
        storage: { ok: false, buckets: [], error: 'Supabase client not configured' },
        error: 'Supabase environment variables are missing or invalid',
      };
    }

    const start = Date.now();
    const tableNames = ['videos', 'categories', 'music_tracks', 'artist_profiles', 'profiles'];
    const tables: Record<string, { ok: boolean; count: number | null; error?: string }> = {};

    let anySuccess = false;
    let firstError: string | undefined;

    await Promise.all(
      tableNames.map(async (table) => {
        try {
          const { count, error } = await rawSupabaseAdmin
            .from(table)
            .select('id', { count: 'exact', head: true });
          if (error) {
            // Try '*' for tables whose PK isn't named 'id' (e.g., profiles uses user_id)
            const retry = await rawSupabaseAdmin
              .from(table)
              .select('*', { count: 'exact', head: true });
            if (retry.error) {
              tables[table] = { ok: false, count: null, error: retry.error.message };
              if (!firstError) firstError = retry.error.message;
            } else {
              anySuccess = true;
              tables[table] = { ok: true, count: retry.count ?? 0 };
            }
          } else {
            anySuccess = true;
            tables[table] = { ok: true, count: count ?? 0 };
          }
        } catch (err: any) {
          tables[table] = { ok: false, count: null, error: err?.message || 'Query error' };
          if (!firstError) firstError = err?.message;
        }
      })
    );

    const latencyMs = Date.now() - start;

    let storage: { ok: boolean; buckets: string[]; error?: string } = {
      ok: false,
      buckets: [],
    };
    try {
      const { data: buckets, error: storageErr } = await rawSupabaseAdmin.storage.listBuckets();
      if (storageErr) {
        storage = { ok: false, buckets: [], error: storageErr.message };
      } else {
        storage = {
          ok: true,
          buckets: (buckets || []).map((b: any) => b.name || b.id).filter(Boolean),
        };
      }
    } catch (err: any) {
      storage = { ok: false, buckets: [], error: err?.message || 'Storage error' };
    }

    return {
      configured: true,
      connected: anySuccess,
      projectId: supabaseProjectInfo.projectId,
      url: supabaseProjectInfo.url,
      latencyMs,
      tables,
      storage,
      error: anySuccess ? undefined : firstError,
    };
  }

  async getSnapshot() {
    const supabaseHealth = await this.checkSupabaseHealth();
    return {
      timestamp: new Date().toISOString(),
      supabase: supabaseHealth,
      api: this.getApiMetrics(),
      system: this.getSystemMetrics(),
    };
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;
