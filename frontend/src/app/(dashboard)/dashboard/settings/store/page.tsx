'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { 
  Store, 
  MapPin, 
  Phone, 
  Globe, 
  MessageSquare, 
  Check, 
  AlertCircle, 
  Image as ImageIcon,
  Printer
} from 'lucide-react';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

export default function StoreProfileSettingsPage() {
  const { stores, currentStoreId, switchStore, user, login } = useAuthStore();
  const activeStore = stores.find((s) => s.id === currentStoreId) || stores[0];

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form States
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [footerNote, setFooterNote] = useState('Terima kasih telah berbelanja');
  const [logo, setLogo] = useState<string | null>(null);

  // Fetch or init active store data
  useEffect(() => {
    if (activeStore) {
      setName(activeStore.name || '');
      setAddress((activeStore as any).address || '');
      setDistrict((activeStore as any).district || '');
      setCity((activeStore as any).city || '');
      setProvince((activeStore as any).province || '');
      setPostalCode((activeStore as any).postalCode || '');
      setPhone((activeStore as any).phone || '');
      setWhatsapp((activeStore as any).whatsapp || '');
      setInstagram((activeStore as any).instagram || '');
      setWebsite((activeStore as any).website || '');
      setFooterNote((activeStore as any).footerNote || 'Terima kasih telah berbelanja');
      setLogo((activeStore as any).logo || null);

      // Fetch fresh details from backend
      api.get(`/stores/${activeStore.id}`)
        .then((res) => {
          if (res.store) {
            const st = res.store;
            setName(st.name || '');
            setAddress(st.address || '');
            setDistrict(st.district || '');
            setCity(st.city || '');
            setProvince(st.province || '');
            setPostalCode(st.postalCode || '');
            setPhone(st.phone || '');
            setWhatsapp(st.whatsapp || '');
            setInstagram(st.instagram || '');
            setWebsite(st.website || '');
            setFooterNote(st.footerNote || 'Terima kasih telah berbelanja');
            setLogo(st.logo || null);
          }
        })
        .catch((err) => console.warn('Failed to fetch detailed store info:', err));
    }
  }, [activeStore?.id]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Ukuran file logo maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    if (!name) {
      setErrorMsg('Nama Toko wajib diisi.');
      return;
    }

    setIsLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const payload = {
        name,
        address,
        district,
        city,
        province,
        postalCode,
        phone,
        whatsapp,
        instagram,
        website,
        footerNote,
        logo,
      };

      const res = await api.put(`/stores/${activeStore.id}/profile`, payload);
      
      // Update store in local auth store state
      const updatedStores = stores.map((s) => (s.id === activeStore.id ? { ...s, ...res.store } : s));
      if (user) {
        login(user, localStorage.getItem('kasirmu_token') || '', updatedStores);
      }

      setSuccessMsg('Profil Toko & Header Struk berhasil diperbarui secara realtime!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memperbarui profil toko.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Store className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Profil Outlet & Setting Struk
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-1">
            Kelola identitas toko, logo, lokasi, kontak, dan teks ucapan footer yang tampil di struk fisik kasir.
          </p>
        </div>

        {/* Store selector if multi-store */}
        {stores.length > 1 && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl shadow-sm">
            <span className="text-xs font-bold text-slate-500 pl-2">Outlet:</span>
            <select
              value={activeStore?.id}
              onChange={(e) => switchStore(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-2"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm animate-shake">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Settings (2 columns) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* CARD 1: IDENTITAS UTAMA & LOGO */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Identitas Toko & Logo</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                      Nama dan logo toko yang akan menjadi header paling atas di struk belanja.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 flex flex-col gap-4">
                <Input
                  id="storeName"
                  type="text"
                  label="Nama Toko / Outlet *"
                  placeholder="KopiMu Cafe & Resto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<Store className="h-4 w-4" />}
                  required
                />

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-slate-500" /> Logo Struk Toko (Opsional)
                  </label>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-3 rounded-xl">
                    <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                      {logo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={logo} alt="Logo Struk" className="object-contain w-full h-full p-1" />
                      ) : (
                        <div className="bg-blue-600 text-white font-black text-xs px-2 py-1 rounded">KM</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="file"
                        accept="image/*"
                        id="logoUpload"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('logoUpload')?.click()}
                          className="text-xs border-slate-300 dark:border-slate-700 font-bold cursor-pointer"
                        >
                          Upload Logo
                        </Button>
                        {logo && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setLogo(null)}
                            className="text-xs border-red-200 text-red-500 hover:bg-red-50 font-bold cursor-pointer"
                          >
                            Hapus Logo
                          </Button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Format PNG/JPG (Transparan direkomendasikan). Jika kosong, struk menggunakan logo bawaan KasirMu.
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CARD 2: ALAMAT LENGKAP LOKASI */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Alamat Lengkap Toko</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                      Informasi lokasi fisik toko untuk dicetak pada header struk.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 flex flex-col gap-4">
                <Input
                  id="address"
                  type="text"
                  label="Alamat Jalan / Ruko"
                  placeholder="Jl. Pemuda No. 120"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  leftIcon={<MapPin className="h-4 w-4" />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="district"
                    type="text"
                    label="Kecamatan"
                    placeholder="Semarang Tengah"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                  <Input
                    id="city"
                    type="text"
                    label="Kota / Kabupaten"
                    placeholder="Kota Semarang"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="province"
                    type="text"
                    label="Provinsi"
                    placeholder="Jawa Tengah"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                  <Input
                    id="postalCode"
                    type="text"
                    label="Kode Pos"
                    placeholder="50132"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* CARD 3: KONTAK & SOSIAL MEDIA */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Kontak & Sosial Media Toko</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                      Tampil pada bagian kontak header & footer struk kasir.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="phone"
                    type="text"
                    label="Nomor Telepon Toko"
                    placeholder="0812-3456-7890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    leftIcon={<Phone className="h-4 w-4" />}
                  />
                  <Input
                    id="whatsapp"
                    type="text"
                    label="WhatsApp Toko"
                    placeholder="081234567890"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    leftIcon={<MessageSquare className="h-4 w-4 text-emerald-500" />}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="instagram"
                    type="text"
                    label="Instagram Toko (misal: @kopimu)"
                    placeholder="@kopimucafe"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    leftIcon={<InstagramIcon className="h-4 w-4 text-pink-500" />}
                  />
                  <Input
                    id="website"
                    type="text"
                    label="Website Toko"
                    placeholder="www.kopimu.id"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    leftIcon={<Globe className="h-4 w-4 text-blue-500" />}
                  />
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <label htmlFor="footerNote" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Pesan Ucapan Footer Struk
                  </label>
                  <textarea
                    id="footerNote"
                    rows={2}
                    placeholder="Terima kasih telah berbelanja..."
                    value={footerNote}
                    onChange={(e) => setFooterNote(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              variant="primary"
              className="bg-blue-600! hover:bg-blue-700! text-white font-extrabold py-3 rounded-xl shadow-lg shadow-blue-600/20 cursor-pointer self-start flex items-center gap-2"
              isLoading={isLoading}
            >
              <Check className="h-4 w-4" />
              Simpan Profil Toko & Struk
            </Button>
          </form>
        </div>

        {/* Live Thermal Receipt Preview (1 column) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-blue-500" /> Live Struk Preview (58mm)
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                Realtime
              </span>
            </div>

            {/* Receipt Box Visual Simulation */}
            <div className="bg-white text-slate-900 border border-slate-300 dark:border-slate-700 p-4 rounded-xl shadow-2xl font-mono text-[10px] leading-relaxed select-none">
              
              {/* Header */}
              <div className="text-center flex flex-col items-center gap-1 border-b border-dashed border-slate-300 pb-3">
                {/* Logo */}
                {logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt="Logo Struk" className="w-12 h-12 object-contain mx-auto mb-1" />
                ) : (
                  <div className="bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 rounded mx-auto mb-1">
                    KasirMu POS
                  </div>
                )}

                <span className="text-xs font-black uppercase tracking-wider block">
                  {name || 'NAMA TOKO ANDA'}
                </span>

                {address && <span className="text-[9px] text-slate-600 block leading-tight">{address}</span>}
                
                {(district || city || province || postalCode) && (
                  <span className="text-[9px] text-slate-600 block leading-tight">
                    {[district, city, province, postalCode].filter(Boolean).join(', ')}
                  </span>
                )}

                {phone && <span className="text-[9px] font-bold text-slate-700 block mt-0.5">Telp : {phone}</span>}
              </div>

              {/* Sample Transaction Items */}
              <div className="py-2.5 border-b border-dashed border-slate-300 flex flex-col gap-1.5 text-slate-600">
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>INV-20260729-0001</span>
                  <span>29/07/2026</span>
                </div>
                <div className="flex justify-between items-start pt-1">
                  <div>
                    <span className="block font-bold text-slate-900">Kopi Es Espresso</span>
                    <span className="block text-[8px]">2x @22.000</span>
                  </div>
                  <span className="font-bold text-slate-900">44.000</span>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="block font-bold text-slate-900">Roti Bakar Cokelat</span>
                    <span className="block text-[8px]">1x @18.000</span>
                  </div>
                  <span className="font-bold text-slate-900">18.000</span>
                </div>
              </div>

              {/* Total calculation */}
              <div className="py-2 flex flex-col gap-1 text-slate-700 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>62.000</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-xs pt-1 border-t border-dotted border-slate-200">
                  <span>TOTAL</span>
                  <span className="text-blue-600">62.000</span>
                </div>
              </div>

              {/* Footer Header */}
              <div className="text-center pt-3 flex flex-col gap-1 text-[8.5px] text-slate-600">
                <span className="font-bold text-slate-800">{footerNote || 'Terima kasih telah berbelanja'}</span>

                {whatsapp && (
                  <span className="block">
                    WhatsApp : <strong className="text-slate-800">{whatsapp}</strong>
                  </span>
                )}
                {instagram && (
                  <span className="block">
                    Instagram : <strong className="text-slate-800">{instagram}</strong>
                  </span>
                )}
                {website && (
                  <span className="block">
                    Website : <strong className="text-slate-800">{website}</strong>
                  </span>
                )}

                <div className="mt-2 pt-2 border-t border-dashed border-slate-300 text-[7.5px] text-slate-400 font-sans tracking-widest uppercase">
                  Powered by KasirMu POS
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
