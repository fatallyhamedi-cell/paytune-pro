import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  Activity,
  Server,
  Database,
  Play,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Cpu,
  Terminal,
} from 'lucide-react';

interface DiagnosticsSnapshot {
  timestamp: string;
  uptime: number;
  database: {
    engine: string;
    configured: boolean;
    connected: boolean;
    latencyMs: number | null;
    projectId: string;
    url: string;
    tables?: Record<string, { ok: boolean; count: number | null; error?: string }>;
  };
  supabase: {
    configured: boolean;
    connected: boolean;
    latencyMs: number | null;
    projectId: string;
    storage?: { ok: boolean; buckets: string[]; error?: string };
  };
  system: {
    platform: string;
    nodeVersion: string;
    cpuCount: number;
    loadAverage: { '1m': number; '5m': number; '15m': number };
    cpuUtilizationPercent: number;
    eventLoopLagMs: number;
    memory: {
      rssBytes: number;
      heapUsedBytes: number;
      systemUsedPercent: number;
    };
  };
  apiMetrics: {
    totalRequests: number;
    totalServerErrors: number;
    errorRatePercent: number;
    slowRequestsCount: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    maxLatencyMs: number;
    topRoutes: Array<{
      route: string;
      count: number;
      errorCount: number;
      avgLatencyMs: number;
      maxLatencyMs: number;
    }>;
  };
}

export const MasterDiagnostics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [runningE2E, setRunningE2E] = useState(false);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [roundtripMs, setRoundtripMs] = useState<number | null>(null);
  const [e2eLogs, setE2eLogs] = useState<string[]>([]);
  const [e2eStatus, setE2eStatus] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const runHealthCheck = useCallback(async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      const res = await api.get<DiagnosticsSnapshot>('/api/diagnostics/check');
      const elapsed = Math.round(performance.now() - startTime);
      setRoundtripMs(elapsed);
      setSnapshot(res.data);
      setMessage({
        text: res.data?.database?.connected
          ? `Connected to Supabase PostgreSQL (${res.data.database.projectId}) — DB Ping ${res.data.database.latencyMs ?? 0}ms, API Roundtrip ${elapsed}ms.`
          : 'API reachable, but Supabase database connection reported degraded status.',
        isError: !res.data?.database?.connected,
      });
    } catch (err: any) {
      setRoundtripMs(Math.round(performance.now() - startTime));
      setMessage({
        text: 'Diagnostics check failed: ' + (err?.response?.data?.error || err.message || 'Unknown error'),
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const runLiveE2E = async () => {
    setRunningE2E(true);
    setMessage(null);
    try {
      const res = await api.post('/api/diagnostics/run-e2e');
      setE2eLogs(Array.isArray(res.data?.logs) ? res.data.logs : []);
      setE2eStatus(res.data?.status || 'SUCCESS');
      await runHealthCheck();
    } catch (err: any) {
      setE2eStatus('FAILED');
      setMessage({
        text: 'E2E verification failed: ' + (err?.response?.data?.error || err.message),
        isError: true,
      });
    } finally {
      setRunningE2E(false);
    }
  };

  const formatMb = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const dbConnected = snapshot?.database?.connected;
  const storageOk = snapshot?.supabase?.storage?.ok;

  return (
    <div id="master-diagnostics-module" className="space-y-6">
      {/* Diagnostics Header */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <span>Live System Telemetry & PostgreSQL Health</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Real-time Supabase PostgreSQL probing, request latency percentiles, storage health, and system metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-run-diagnostics"
            onClick={runHealthCheck}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Probing DB...' : 'Refresh Telemetry'}</span>
          </button>

          <button
            id="btn-run-e2e-suite"
            onClick={runLiveE2E}
            disabled={runningE2E}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 text-purple-400 ${runningE2E ? 'animate-pulse' : ''}`} />
            <span>{runningE2E ? 'Running Live Audit...' : 'Run Live E2E Audit'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center space-x-2 ${
            message.isError
              ? 'bg-red-950/30 border-red-700/40 text-red-300'
              : 'bg-neutral-900 border-purple-600/30 text-purple-300'
          }`}
        >
          {message.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-medium">PostgreSQL (Supabase)</span>
            <Database className={`w-4 h-4 ${dbConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <p className={`text-lg font-black ${dbConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {snapshot ? (dbConnected ? 'CONNECTED' : 'DEGRADED') : 'CHECKING...'}
          </p>
          <div className="text-[11px] text-neutral-400">
            Project: <code className="text-neutral-200">{snapshot?.database?.projectId || '...'}</code> · Ping:{' '}
            <span className="text-white font-semibold">
              {snapshot?.database?.latencyMs !== null && snapshot?.database?.latencyMs !== undefined
                ? `${snapshot.database.latencyMs} ms`
                : '—'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-medium">API Latency (Avg / p95)</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-lg font-black text-purple-400">
            {snapshot ? `${snapshot.apiMetrics.avgLatencyMs}ms / ${snapshot.apiMetrics.p95LatencyMs}ms` : '—'}
          </p>
          <div className="text-[11px] text-neutral-400">
            Requests: <span className="text-white font-semibold">{snapshot?.apiMetrics?.totalRequests ?? 0}</span> ·
            Errors: <span className="text-white font-semibold">{snapshot?.apiMetrics?.errorRatePercent ?? 0}%</span> ·
            Client RTT: <span className="text-white font-semibold">{roundtripMs ? `${roundtripMs}ms` : '—'}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-medium">Process & CPU Load</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-black text-white">
            {snapshot ? `${snapshot.system.loadAverage['1m']} (${snapshot.system.cpuCount} cores)` : '—'}
          </p>
          <div className="text-[11px] text-neutral-400">
            Heap: <span className="text-white font-semibold">{formatMb(snapshot?.system?.memory?.heapUsedBytes)}</span> ·
            Event Loop Lag: <span className="text-white font-semibold">{snapshot?.system?.eventLoopLagMs ?? 0}ms</span> ·
            Uptime: <span className="text-white font-semibold">{formatUptime(snapshot?.uptime)}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-medium">Supabase Storage</span>
            <HardDrive className={`w-4 h-4 ${storageOk ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <p className={`text-lg font-black ${storageOk ? 'text-white' : 'text-amber-400'}`}>
            {snapshot?.supabase?.storage ? `${snapshot.supabase.storage.buckets.length} Buckets` : '—'}
          </p>
          <div className="text-[11px] text-neutral-400 truncate">
            {snapshot?.supabase?.storage?.buckets?.join(', ') || snapshot?.supabase?.storage?.error || 'Checking buckets...'}
          </div>
        </div>
      </div>

      {/* Live Schema Table Probe + Route Performance */}
      {snapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 space-y-3">
            <h3 className="text-sm font-bold text-white">PostgreSQL Table Probes</h3>
            <div className="divide-y divide-neutral-800">
              {Object.entries(snapshot.database.tables || {}).map(([table, info]) => (
                <div key={table} className="py-2 flex items-center justify-between">
                  <span className="font-mono text-neutral-200">{table}</span>
                  <span className={info.ok ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {info.ok ? `OK (${info.count ?? 0} rows)` : `ERR: ${info.error}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 space-y-3">
            <h3 className="text-sm font-bold text-white">Top Monitored API Routes</h3>
            {snapshot.apiMetrics.topRoutes.length === 0 ? (
              <p className="text-neutral-500">Traffic telemetry will appear as requests arrive.</p>
            ) : (
              <div className="divide-y divide-neutral-800 max-h-56 overflow-y-auto">
                {snapshot.apiMetrics.topRoutes.map((r) => (
                  <div key={r.route} className="py-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-neutral-200 truncate">{r.route}</span>
                    <span className="text-neutral-400 shrink-0">
                      {r.count} req · <strong className="text-purple-400">{r.avgLatencyMs}ms</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* E2E Audit Log Output */}
      {e2eLogs.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#111111] border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>Live E2E Verification Output</span>
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                e2eStatus === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {e2eStatus}
            </span>
          </div>
          <div className="bg-black/60 border border-neutral-800 rounded-xl p-3 font-mono text-[11px] text-neutral-300 space-y-1 max-h-64 overflow-y-auto">
            {e2eLogs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
