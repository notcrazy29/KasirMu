'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { 
  FileSpreadsheet, 
  Search, 
  ShieldAlert, 
  Terminal, 
  UserCheck, 
  Lock,
  Globe,
  Monitor
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  targetId: string | null;
  description: string;
  createdAt: string;
}

interface LoginActivity {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  device: string | null;
  status: string;
  isSuspicious: boolean;
  description: string | null;
  createdAt: string;
}

export default function SuperAdminLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginActivities, setLoginActivities] = useState<LoginActivity[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'login'>('audit');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/superadmin/logs');
      setAuditLogs(res.auditLogs || []);
      setLoginActivities(res.loginActivities || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Filter logs based on search query
  const filteredAudit = auditLogs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.actorId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogin = loginActivities.filter(log => 
    log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-500" />
            <span>Audit Trail & Log Keamanan</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Lacak log mutasi data, pelacakan IP login, deteksi device, dan analisis aktivitas mencurigakan.</p>
        </div>
      </div>

      {/* Tabs & Search controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-900">
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-850 w-full sm:w-auto max-w-xs">
          <button
            onClick={() => {
              setActiveTab('audit');
              setSearchQuery('');
            }}
            className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'audit' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Audit Trail
          </button>
          <button
            onClick={() => {
              setActiveTab('login');
              setSearchQuery('');
            }}
            className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'login' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Aktivitas Login
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cari log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Audit Log View */}
      {activeTab === 'audit' && (
        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
          <CardContent className="p-0">
            {filteredAudit.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">Tidak ada log audit ditemukan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900">
                    <tr>
                      <th className="px-6 py-4">Waktu Kejadian</th>
                      <th className="px-6 py-4">Aksi</th>
                      <th className="px-6 py-4">Aktor ID</th>
                      <th className="px-6 py-4">Target ID</th>
                      <th className="px-6 py-4">Penjelasan Aktivitas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                    {filteredAudit.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">{formatDate(log.createdAt)}</td>
                        <td className="px-6 py-4 font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${
                            log.action.includes('APPROVE') ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/10' :
                            log.action.includes('REJECT') || log.action.includes('SUSPEND') || log.action.includes('DELETE') ? 'bg-red-950/40 text-red-400 border-red-500/10' :
                            log.action.includes('IMPERSONATE') ? 'bg-amber-950/40 text-amber-400 border-amber-500/10' :
                            'bg-slate-950 text-slate-400 border-slate-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono truncate max-w-[120px]">{log.actorId}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono truncate max-w-[120px]">{log.targetId || '-'}</td>
                        <td className="px-6 py-4 text-slate-900 dark:text-white font-semibold">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Login Activity View */}
      {activeTab === 'login' && (
        <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/10">
          <CardContent className="p-0">
            {filteredLogin.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">Tidak ada log aktivitas login ditemukan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900">
                    <tr>
                      <th className="px-6 py-4">Waktu</th>
                      <th className="px-6 py-4">Email Pengguna</th>
                      <th className="px-6 py-4">IP Address</th>
                      <th className="px-6 py-4">Device</th>
                      <th className="px-6 py-4">User Agent / Browser</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Deteksi Keamanan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                    {filteredLogin.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">{formatDate(log.createdAt)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{log.email}</td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mt-2">
                          <Globe className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                          <span className="font-mono">{log.ipAddress}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Monitor className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                            <span>{log.device || 'Desktop'}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 truncate max-w-[200px]" title={log.userAgent}>{log.userAgent}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                            log.status === 'SUCCESS' 
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/10' 
                              : 'bg-red-950 text-red-400 border border-red-500/10'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {log.isSuspicious ? (
                            <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-500/20 rounded-full text-[9px] font-bold flex items-center justify-center gap-1.5 w-max mx-auto animate-pulse">
                              <ShieldAlert className="h-3 w-3" />
                              Mencurigakan
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
