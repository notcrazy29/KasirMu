'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
  CreditCard,
  Sparkles,
  Users,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Store,
  Package,
  Tag,
  Shield,
  Zap,
  FileText,
  BarChart3,
  Brain,
  Globe,
  GitBranch,
  Heart,
  Gift,
} from 'lucide-react';
import Button from '@/components/ui/Button';

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string;
  durationDays: number;
  isActive: boolean;
  maxStore: number;
  maxProduct: number;
  maxCashier: number;
  maxCategory: number;
  canUseMidtrans: boolean;
  canUseQRIS: boolean;
  canUseExport: boolean;
  canUseAnalytics: boolean;
  canUseAPI: boolean;
  canUseAI: boolean;
  canUseMultiBranch: boolean;
  canUseLoyalty: boolean;
  canUsePromo: boolean;
  _count?: { subscriptions: number };
}

interface SubscriberRecord {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  user: { id: string; name: string; email: string; role: string };
  plan: Plan;
  payments: { status: string; amount: number; createdAt: string }[];
}

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  referenceId: string;
  createdAt: string;
  subscription: {
    user: { name: string; email: string };
    plan: { name: string; price: number };
  };
}

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount));

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const isUnlimited = (v: number) => v === -1;

const featureFlagKeys = [
  { key: 'canUseMidtrans', label: 'Midtrans', icon: CreditCard },
  { key: 'canUseQRIS', label: 'QRIS', icon: Zap },
  { key: 'canUseExport', label: 'Export', icon: FileText },
  { key: 'canUseAnalytics', label: 'Analitik', icon: BarChart3 },
  { key: 'canUseAI', label: 'AI', icon: Brain },
  { key: 'canUseAPI', label: 'API', icon: Globe },
  { key: 'canUseMultiBranch', label: 'Multi Cabang', icon: GitBranch },
  { key: 'canUseLoyalty', label: 'Loyalty', icon: Heart },
  { key: 'canUsePromo', label: 'Promo', icon: Gift },
];

// ──────────────────────────────────────────────────
// Plan Edit Row
// ──────────────────────────────────────────────────

function PlanRow({ plan, onSave }: { plan: Plan; onSave: (id: string, data: Partial<Plan>) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Plan>>({});

  const startEdit = () => {
    setEditData({
      price: plan.price,
      durationDays: plan.durationDays,
      maxStore: plan.maxStore,
      maxProduct: plan.maxProduct,
      maxCashier: plan.maxCashier,
      maxCategory: plan.maxCategory,
      isActive: plan.isActive,
      canUseMidtrans: plan.canUseMidtrans,
      canUseQRIS: plan.canUseQRIS,
      canUseExport: plan.canUseExport,
      canUseAnalytics: plan.canUseAnalytics,
      canUseAI: plan.canUseAI,
      canUseAPI: plan.canUseAPI,
      canUseMultiBranch: plan.canUseMultiBranch,
      canUseLoyalty: plan.canUseLoyalty,
      canUsePromo: plan.canUsePromo,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(plan.id, editData);
    setSaving(false);
    setIsEditing(false);
  };

  const isPremium = plan.name === 'PREMIUM';

  return (
    <div className={`rounded-xl border p-5 transition-all ${
      isPremium
        ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20'
        : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/20'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-slate-900 dark:text-white">{plan.name}</span>
            {isPremium && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">Premium</span>
            )}
            {!plan.isActive && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 uppercase">Nonaktif</span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{plan.description}</p>
          <p className="text-xs text-slate-500 mt-1">{plan._count?.subscriptions ?? 0} subscriber aktif</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Harga', value: isEditing ? editData.price : plan.price, field: 'price', type: 'number', prefix: 'Rp' },
          { label: 'Durasi (hari)', value: isEditing ? editData.durationDays : plan.durationDays, field: 'durationDays', type: 'number' },
        ].map(({ label, value, field, type }) => (
          <div key={field} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
            {isEditing ? (
              <input
                type={type}
                value={value as any}
                onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.valueAsNumber || e.target.value }))}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold px-2.5 py-1.5 rounded-lg w-full"
              />
            ) : (
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {field === 'price' ? formatCurrency(plan.price) : `${value}`}
              </span>
            )}
          </div>
        ))}

        {/* Resource Limits */}
        {[
          { label: 'Max Toko', field: 'maxStore', value: isEditing ? editData.maxStore : plan.maxStore },
          { label: 'Max Produk', field: 'maxProduct', value: isEditing ? editData.maxProduct : plan.maxProduct },
          { label: 'Max Kasir', field: 'maxCashier', value: isEditing ? editData.maxCashier : plan.maxCashier },
          { label: 'Max Kategori', field: 'maxCategory', value: isEditing ? editData.maxCategory : plan.maxCategory },
        ].map(({ label, field, value }) => (
          <div key={field} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
            {isEditing ? (
              <input
                type="number"
                min={-1}
                value={value as any}
                onChange={(e) => setEditData((prev) => ({ ...prev, [field]: parseInt(e.target.value) }))}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold px-2.5 py-1.5 rounded-lg w-full"
              />
            ) : (
              <span className={`text-sm font-bold ${isUnlimited(value as number) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {isUnlimited(value as number) ? '∞ Unlimited' : value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Feature Flags */}
      <div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Fitur Aktif</span>
        <div className="flex flex-wrap gap-2">
          {featureFlagKeys.map(({ key, label, icon: Icon }) => {
            const val = isEditing ? (editData as any)[key] : (plan as any)[key];
            return (
              <button
                key={key}
                disabled={!isEditing}
                onClick={() => {
                  if (isEditing) setEditData((prev) => ({ ...prev, [key]: !val }));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  val
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500'
                } ${isEditing ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                <Icon className="h-3 w-3" />
                {label}
                {isEditing && (val ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status toggle */}
      {isEditing && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400">Status Plan:</span>
          <button
            onClick={() => setEditData((prev) => ({ ...prev, isActive: !prev.isActive }))}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            {editData.isActive ? (
              <><ToggleRight className="h-5 w-5 text-emerald-500" /><span className="text-emerald-500">Aktif</span></>
            ) : (
              <><ToggleLeft className="h-5 w-5 text-slate-400" /><span className="text-slate-400">Nonaktif</span></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────

type TabType = 'plans' | 'subscribers' | 'revenue';

export default function SuperadminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [premiumCount, setPremiumCount] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // MRR/ARR metrics
  const [mrr, setMrr] = useState(0);
  const [arr, setArr] = useState(0);
  const [expiredThisMonth, setExpiredThisMonth] = useState(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plansRes, subsRes, revRes, metricsRes] = await Promise.all([
        api.get('/subscriptions/admin/plans'),
        api.get('/subscriptions/admin/all'),
        api.get('/subscriptions/admin/revenue'),
        api.get('/subscriptions/admin/metrics'),
      ]);
      setPlans(plansRes.plans || []);
      setSubscribers(subsRes.subscriptions || []);
      setPayments(revRes.payments || []);
      setTotalRevenue(revRes.totalRevenue || 0);
      setPremiumCount(revRes.premiumCount || 0);
      setFreeCount(revRes.freeCount || 0);
      setExpiredCount(revRes.expiredCount || 0);
      setMrr(metricsRes.mrr || 0);
      setArr(metricsRes.arr || 0);
      setExpiredThisMonth(metricsRes.expiredThisMonth || 0);
    } catch (err) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePlan = async (id: string, data: Partial<Plan>) => {
    try {
      await api.put(`/subscriptions/admin/plans/${id}`, data);
      setSuccessMsg('Plan berhasil diperbarui!');
      await loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui plan');
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'plans', label: 'Kelola Plan', icon: CreditCard },
    { id: 'subscribers', label: 'Subscriber', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
  ];

  // Summary stats
  const totalSubscribers = subscribers.length;
  const activeSubscribers = subscribers.filter((s) => s.status === 'ACTIVE').length;
  const freeUsers = subscribers.filter((s) => s.plan.name === 'FREE').length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-blue-500" />
          Manajemen Subscription
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Kelola paket langganan, pantau subscriber, dan monitor revenue
        </p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
          <button onClick={() => setErrorMsg('')} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Summary KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Owner Premium', value: premiumCount, icon: Sparkles, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Owner Free', value: freeCount, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Subscription Aktif', value: activeSubscribers, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Subscription Expired', value: expiredCount, icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <CardContent className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block uppercase tracking-wider">{label}</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary KPI Row 2 — MRR / ARR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5 dark:bg-gradient-to-br dark:from-emerald-950/40 dark:to-slate-900/40">
          <CardContent className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block uppercase tracking-wider">MRR</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(mrr)}</span>
              <span className="text-[10px] text-slate-500 block">Monthly Recurring Revenue</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5 dark:bg-gradient-to-br dark:from-blue-950/40 dark:to-slate-900/40">
          <CardContent className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block uppercase tracking-wider">ARR</span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(arr)}</span>
              <span className="text-[10px] text-slate-500 block">Annual Recurring Revenue</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5 dark:bg-gradient-to-br dark:from-red-950/20 dark:to-slate-900/40">
          <CardContent className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block uppercase tracking-wider">Expired Bulan Ini</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-400">{expiredThisMonth}</span>
              <span className="text-[10px] text-slate-500 block">Subscription tidak diperbarui</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 rounded-full border-t-2 border-blue-500" />
        </div>
      ) : (
        <>
          {/* ── Tab: Plans ── */}
          {activeTab === 'plans' && (
            <div className="flex flex-col gap-4">
              {plans.map((plan) => (
                <PlanRow key={plan.id} plan={plan} onSave={handleSavePlan} />
              ))}
            </div>
          )}

          {/* ── Tab: Subscribers ── */}
          {activeTab === 'subscribers' && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        {['Owner', 'Email', 'Paket', 'Status', 'Mulai', 'Berakhir'].map((col) => (
                          <th key={col} className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                      {subscribers.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{sub.user.name}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{sub.user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`font-black px-2 py-0.5 rounded-full text-[10px] ${
                              sub.plan.name === 'PREMIUM'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}>
                              {sub.plan.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : sub.status === 'EXPIRED'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(sub.startDate)}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {new Date(sub.endDate).getFullYear() > 2100 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">∞ Unlimited</span>
                            ) : (
                              formatDate(sub.endDate)
                            )}
                          </td>
                        </tr>
                      ))}
                      {subscribers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-500">
                            Belum ada subscriber terdaftar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Tab: Revenue ── */}
          {activeTab === 'revenue' && (
            <div className="flex flex-col gap-4">
              <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-gradient-to-br dark:from-amber-950/30 dark:to-orange-950/20 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Revenue Subscription</span>
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(totalRevenue)}</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">{premiumCount} pengguna Premium aktif</span>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                          {['Owner', 'Paket', 'Jumlah', 'Metode', 'Referensi', 'Tanggal'].map((col) => (
                            <th key={col} className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{p.subscription.user.name}</td>
                            <td className="px-4 py-3">
                              <span className="text-amber-500 font-bold">{p.subscription.plan.name}</span>
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold">{p.paymentMethod || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{p.referenceId?.slice(0, 20) || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(p.createdAt)}</td>
                          </tr>
                        ))}
                        {payments.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-slate-500">
                              Belum ada pembayaran subscription tercatat.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
