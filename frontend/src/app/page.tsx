'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '../store/useAuthStore';
import { 
  QrCode, 
  TrendingUp, 
  Users, 
  Layers, 
  Smartphone, 
  CheckCircle, 
  Bell, 
  Database,
  ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();

  const features = [
    {
      icon: <QrCode className="h-6 w-6 text-blue-500" />,
      title: "Pembayaran QRIS Realtime",
      desc: "Integrasi dinamis dengan Midtrans. Cukup klik bayar, scan, dan transaksi terupdate secara live."
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-emerald-500" />,
      title: "Dashboard Owner Realtime",
      desc: "Pantau grafik omzet, volume transaksi, dan stok produk secara live dari mana saja."
    },
    {
      icon: <Users className="h-6 w-6 text-indigo-500" />,
      title: "QR Pairing Kasir",
      desc: "Hubungkan device kasir baru ke toko dalam hitungan detik hanya dengan memindai QR Code."
    },
    {
      icon: <Layers className="h-6 w-6 text-purple-500" />,
      title: "Multi Store & Cabang",
      desc: "Kelola banyak cabang toko dalam satu akun owner dengan switch context yang instan."
    },
    {
      icon: <Smartphone className="h-6 w-6 text-pink-500" />,
      title: "Optimasi Mobile & Desktop",
      desc: "Antarmuka responsif. Nyaman digunakan di PC kasir maupun tablet Android kasir Anda."
    },
    {
      icon: <Database className="h-6 w-6 text-amber-500" />,
      title: "Manajemen Stok & Alergi",
      desc: "Pengurangan stok otomatis saat transaksi lengkap dengan notifikasi alarm stok menipis."
    }
  ];

  const defaultPricingPlans = [
    {
      name: "Paket FREE",
      price: "Gratis",
      period: "selamanya",
      desc: "Cocok untuk UMKM pemula & warung kecil",
      features: [
        "1 Toko & 1 Cabang",
        "Maksimal 5 Produk",
        "Maksimal 3 Kasir",
        "Maksimal 2 Kategori",
        "Pembayaran Tunai",
        "Dashboard Analitik Dasar"
      ],
      cta: "Daftar Gratis",
      popular: false,
    },
    {
      name: "Paket PREMIUM",
      price: "Rp 80.000",
      period: "bulan",
      desc: "Solusi lengkap & terbaik untuk bisnis berkembang",
      features: [
        "Hingga 5 Toko & Multi Cabang",
        "Produk & Stok Tidak Terbatas",
        "Kasir & Kategori Tidak Terbatas",
        "Integrasi Pembayaran QRIS Midtrans",
        "Realtime WebSocket Sync",
        "AI Analytics & Sales Prediction",
        "Export Laporan Excel & PDF",
        "Customer Loyalty & Promo Voucher"
      ],
      cta: "Mulai Sekarang",
      popular: true,
    },
    {
      name: "Paket ENTERPRISE",
      price: "Hubungi Kami",
      period: "custom",
      desc: "Untuk franchise & jaringan toko retail skala besar",
      features: [
        "Semua Fitur Paket Premium",
        "Jumlah Toko & Cabang Custom",
        "Dedicated Database / Cloud Server",
        "Custom Domain & Branding",
        "Dukungan Prioritas Dedicated 24/7",
        "PWA & Custom POS App Integration"
      ],
      cta: "Hubungi Sales",
      popular: false,
    }
  ];

  const [pricingPlans, setPricingPlans] = React.useState(defaultPricingPlans);

  React.useEffect(() => {
    // Fetch live plans from public endpoint
    fetch('/api/subscriptions/public-plans')
      .then(res => res.json())
      .then(data => {
        if (data && data.plans && data.plans.length > 0) {
          const mapped = data.plans
            .filter((p: any) => p.name !== 'PREMIUM TRIAL') // Hide internal trial from main cards
            .map((p: any) => {
              const isFree = p.price === 0;
              const isPopular = p.name.toUpperCase().includes('PREMIUM');
              const formattedPrice = isFree 
                ? 'Gratis' 
                : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.price);
              
              const featureList = p.features 
                ? p.features.split(',').slice(0, 8) 
                : [];

              return {
                name: `Paket ${p.name}`,
                price: formattedPrice,
                period: isFree ? 'selamanya' : 'bulan',
                desc: p.description || (isFree ? 'Untuk usaha pemula' : 'Solusi lengkap bisnis Anda'),
                features: featureList.length > 0 ? featureList : [
                  `${p.maxStore === -1 ? 'Unlimited' : p.maxStore} Toko`,
                  `${p.maxProduct === -1 ? 'Unlimited' : p.maxProduct} Produk`,
                  `${p.maxCashier === -1 ? 'Unlimited' : p.maxCashier} Kasir`,
                  p.canUseQRIS ? 'Integrasi QRIS Midtrans' : 'Pembayaran Tunai',
                  p.canUseAI ? 'AI Analytics & Prediction' : 'Dashboard Analitik'
                ],
                cta: isFree ? 'Daftar Gratis' : 'Mulai Sekarang',
                popular: isPopular,
              };
            });

          if (mapped.length > 0) {
            // Append Enterprise tier if not present
            if (!mapped.some((m: any) => m.name.includes('ENTERPRISE'))) {
              mapped.push(defaultPricingPlans[2]);
            }
            setPricingPlans(mapped);
          }
        }
      })
      .catch(() => {
        // Fallback to default exact database plans
      });
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white font-black text-lg">KM</div>
          <span className="text-xl font-bold tracking-tight text-white">Kasir<span className="text-blue-500">Mu</span></span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Fitur</a>
          <a href="#mockup" className="hover:text-white transition-colors">Demo POS</a>
          <a href="#pricing" className="hover:text-white transition-colors">Harga</a>
        </nav>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link 
              href={user?.role === 'OWNER' ? '/dashboard' : '/pos'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-1.5"
            >
              Masuk Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login?role=owner" className="text-sm font-bold text-slate-300 hover:text-white transition-colors">
                Login Owner
              </Link>
              <Link 
                href="/login?role=cashier" 
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg text-sm font-bold tracking-wide transition-all"
              >
                Login Kasir
              </Link>
              <Link 
                href="/register" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition-all shadow-lg hover:shadow-blue-500/25"
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Background gradient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs font-semibold text-blue-400 mb-8 animate-pulse">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>SaaS Kasir Pintar Generasi Baru</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight">
          Aplikasi Kasir Modern Terintegrasi <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">QRIS</span> & Realtime Dashboard
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mt-6 leading-relaxed">
          Ubah bisnis retail, cafe, minimarket, atau laundry Anda menjadi serba otomatis. Kelola inventaris, pairing staf kasir secara nirkabel, dan terima QRIS langsung di layar mesin kasir.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link 
            href="/register" 
            className="bg-blue-600 hover:bg-blue-700 text-white text-base font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2"
          >
            Mulai Gratis Sekarang <ArrowRight className="h-5 w-5" />
          </Link>
          <a 
            href="#mockup" 
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-base font-bold px-8 py-3.5 rounded-xl transition-all"
          >
            Lihat Demo POS
          </a>
        </div>

        <div className="mt-6 text-sm text-slate-400 flex items-center gap-2 justify-center bg-slate-900/40 border border-slate-900 px-4 py-2 rounded-full backdrop-blur-sm">
          <span>Sudah punya akun?</span>
          <Link href="/login?role=owner" className="text-blue-400 hover:text-blue-300 font-bold hover:underline">
            Login Owner
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/login?role=cashier" className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline">
            Login Kasir
          </Link>
        </div>

        {/* Feature quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 border-t border-slate-900 mt-20 pt-10 w-full max-w-5xl text-left">
          <div>
            <span className="block text-3xl font-black text-white">99.9%</span>
            <span className="text-xs text-slate-500 mt-1 block">Uptime Callback QRIS</span>
          </div>
          <div>
            <span className="block text-3xl font-black text-white">&lt; 1 Detik</span>
            <span className="text-xs text-slate-500 mt-1 block">Sinkronisasi Realtime</span>
          </div>
          <div>
            <span className="block text-3xl font-black text-white">Multi</span>
            <span className="text-xs text-slate-500 mt-1 block">Cabang & Lokasi Toko</span>
          </div>
          <div>
            <span className="block text-3xl font-black text-white">IDR 0</span>
            <span className="text-xs text-slate-500 mt-1 block">Biaya Setup Awal</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="bg-slate-900/40 border-y border-slate-900 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              Dipercaya UMKM Hingga Jaringan Retail
            </h2>
            <p className="text-slate-400 mt-4">
              Didesain dengan performa tinggi dan fitur lengkap untuk mempermudah kegiatan operasional harian merchant.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat, index) => (
              <div key={index} className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex flex-col gap-4 hover:border-slate-700 transition-colors">
                <div className="bg-slate-950 p-3.5 rounded-xl w-fit">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-bold text-white">{feat.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mockup Preview Section */}
      <section id="mockup" className="py-24 px-6 max-w-7xl mx-auto text-center">
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Antarmuka Kasir & POS yang Menawan
          </h2>
          <p className="text-slate-400 mt-4">
            Kecepatan transaksi adalah kunci. POS KasirMu didesain ultra-fast dengan integrasi scanner barcode kamera maupun hardware.
          </p>
        </div>

        <div className="relative border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 p-2 shadow-2xl">
          <div className="absolute top-4 left-4 flex gap-1.5 z-10">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          {/* Visual POS mockup representation */}
          <div className="bg-slate-950 rounded-xl aspect-[16/9] w-full flex items-center justify-center p-8 text-slate-500">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Smartphone className="h-8 w-8" />
              </div>
              <span className="text-sm font-medium text-slate-300">Cobalah login di menu masuk untuk menikmati simulator POS & WebSockets!</span>
              <div className="flex gap-4">
                <div className="px-4 py-2 border border-slate-800 rounded-lg text-xs bg-slate-900">Owner ID: owner@kasirmu.com / owner123</div>
                <div className="px-4 py-2 border border-slate-800 rounded-lg text-xs bg-slate-900">Kasir ID: cashier@kasirmu.com / cashier123</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-slate-900/30 border-t border-slate-900 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              Biaya Langganan Sederhana & Transparan
            </h2>
            <p className="text-slate-400 mt-4">
              Tidak ada biaya tersembunyi. Pilih paket yang paling cocok dengan kebutuhan skala bisnis Anda.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {pricingPlans.map((plan, index) => (
              <div 
                key={index} 
                className={`bg-slate-900 border flex flex-col p-8 rounded-2xl relative ${
                  plan.popular ? 'border-blue-500 shadow-blue-500/10 shadow-xl' : 'border-slate-850'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full shadow-md">
                    Terpopuler
                  </span>
                )}

                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    <span className="text-slate-500 text-sm">/{plan.period}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">{plan.desc}</p>
                </div>

                <ul className="flex-1 flex flex-col gap-3 mt-8 text-sm">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 text-slate-300">
                      <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link 
                  href="/register" 
                  className={`mt-8 text-center font-bold text-sm py-3 rounded-xl transition-all ${
                    plan.popular 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20' 
                      : 'bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-12 px-6 bg-slate-950 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded text-white font-black text-sm">KM</div>
            <span className="font-bold text-white">KasirMu</span>
          </div>

          <p className="text-slate-500 text-xs">
            © 2026 KasirMu SmartPOS Inc. Dibuat untuk UMKM Indonesia Tangguh & Digital.
          </p>

          <div className="flex gap-4 text-xs text-slate-500">
            <span className="hover:text-slate-300 cursor-pointer">Syarat & Ketentuan</span>
            <span className="hover:text-slate-300 cursor-pointer">Kebijakan Privasi</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
