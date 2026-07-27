# KasirMu - SmartPOS QRIS & Realtime Dashboard 🚀

**KasirMu** adalah platform kasir / POS (Point of Sale) modern berbasis web yang siap dikomersialkan sebagai perangkat lunak SaaS (Software as a Service) untuk UMKM, cafe, retail, laundry, dan minimarket. Platform ini mengusung sistem multi-user/role, sinkronisasi realtime, pairing kasir menggunakan QR Code, serta integrasi pembayaran QRIS dinamis via Midtrans.

---

## 🛠️ Tech Stack & Arsitektur

Platform ini dipisahkan menjadi dua layanan utama (Monorepo):
1. **Frontend (`/frontend`)**: Built with Next.js 15, TypeScript, TailwindCSS v4, Zustand, Recharts, and Socket.io-client.
2. **Backend (`/backend`)**: Built with Express.js, TypeScript, Prisma ORM, Socket.IO WebSockets, and Midtrans SDK.

---

## 📂 Struktur Folder Proyek

```
KasirMu/
├── backend/                  # REST API & WebSockets Engine
│   ├── prisma/               # Schema Database & Seed Script
│   └── src/                  # Controller, Service, Middleware, Router
└── frontend/                 # Next.js Dashboard & POS Workspace
    └── src/
        ├── app/              # Next.js App Router (Landing, Dashboard, POS)
        ├── components/       # Shadcn-inspired UI Primitives
        ├── hooks/            # Custom Hooks (WebSockets useSocket)
        └── store/            # Zustand Stores (Auth & Cart state)
```

---

## 🚀 Panduan Instalasi Lokal

### Prasyarat
- **Node.js** (Rekomendasi v20+ atau v24)
- **PostgreSQL** database (atau remote Supabase URL)

---

### Langkah 1: Setup Database & Backend

1. Buka terminal baru dan masuk ke folder `backend`:
   ```bash
   cd backend
   ```
2. Buat file `.env` (duplikat dari `.env.example`) dan isi variabel lingkungan Anda:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:password@localhost:5432/kasirmu?schema=public"
   JWT_SECRET="isi_kunci_rahasia_jwt_anda"
   MIDTRANS_SERVER_KEY="SB-Mid-server-..."
   MIDTRANS_CLIENT_KEY="SB-Mid-client-..."
   MIDTRANS_IS_PRODUCTION=false
   CLIENT_URL="http://localhost:3000"
   ```
3. Instal seluruh dependencies:
   ```bash
   npm install
   ```
4. Jalankan migrasi Prisma untuk membangun skema tabel database:
   ```bash
   npx prisma db push
   ```
5. Seed database dengan data dummy awal (Owner, Cashier, Categories, Products, and Shifts):
   ```bash
   npm run seed
   ```
6. Jalankan server backend dalam mode development:
   ```bash
   npm run dev
   ```
   *Backend akan berjalan di port `http://localhost:5000`*

---

### Langkah 2: Setup Frontend Next.js

1. Buka terminal baru dan masuk ke folder `frontend`:
   ```bash
   cd ../frontend
   ```
2. Buat file `.env.local` untuk mengarahkan API URL:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:5000/api"
   NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
   ```
3. Instal dependencies:
   ```bash
   npm install
   ```
4. Jalankan Next.js development server:
   ```bash
   npm run dev
   ```
   *Frontend akan berjalan di port `http://localhost:3000`*

---

## 🔐 Kredensial Login Demo (Seeded)

Setelah menjalankan `npm run seed` di backend, Anda dapat langsung login di `http://localhost:3000/login` menggunakan akun berikut:

### 1. Peran Owner (Owner Dashboard)
- **Email**: `owner@kasirmu.com`
- **Password**: `owner123`
- *Fitur: Manajemen toko & cabang, CRUD produk & kategori, grafik analytics omzet, pendaftaran kasir, pairing QR code.*

### 2. Peran Kasir (POS Terminal)
- **Email**: `cashier@kasirmu.com`
- **Password**: `cashier123`
- *Fitur: Scan pairing toko, buka/tutup shift laci kasir, input belanja POS, barcode scanner, generate QRIS, thermal print struk.*

---

## 💳 Tutorial Integrasi Midtrans QRIS & Sandbox Simulator

Platform ini mendukung dua mode operasional pembayaran QRIS:
1. **Mode Terintegrasi Live (Sandbox/Production)**: Mengirimkan request charge langsung ke Midtrans API.
2. **Mode Simulator Lokal (Bawaan)**: Jika file `.env` menggunakan token placeholder (misal `SB-Mid-server-placeholderkey`), backend akan otomatis memicu simulasi QRIS lokal sehingga Anda tetap dapat menguji siklus POS checkout lunas tanpa koneksi internet atau API key asli.

### Alur Kerja Transaksi QRIS Realtime:
1. Petugas kasir memilih pembayaran **QRIS** dan menekan tombol **Bayar**.
2. Backend memanggil Midtrans Core API `/v2/charge` dengan parameter `payment_type: "qris"`.
3. Midtrans membalas dengan string payload QRIS dan URL gambar QR.
4. POS Kasir menampilkan QR Code tersebut di layar.
5. **Simulasi Pembayaran**:
   - Klik tombol **"Simulasikan Callback Selesai"** (di modal kasir) ATAU klik tombol **"Settle"** (pada riwayat transaksi owner).
   - Backend memicu callback simulasi yang meniru payload Webhook Midtrans.
6. DB terupdate menjadi `PAID` (Lunas), event disebarkan via Socket.IO, layar kasir langsung menutup QR dan memunculkan struk belanja lunas, serta meluncurkan animasi perayaan *canvas-confetti*!
7. Kasir dapat langsung menekan tombol **Print Struk** untuk mencetak struk thermal 58mm atau mengunduh versi PDF.
