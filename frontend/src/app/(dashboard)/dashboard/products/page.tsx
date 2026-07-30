'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Dialog from '@/components/ui/Dialog';
import Badge from '@/components/ui/Badge';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash, 
  Image as ImageIcon,
  Tag,
  Upload,
  X,
  Link
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  description: string | null;
  price: string | number;
  costPrice: string | number;
  stock: number;
  minStockAlert: number;
  image: string | null;
  categoryId: string | null;
  category?: Category | null;
}

export default function ProductsPage() {
  const { currentStoreId } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'file' | 'url'>('file');

  // Form Fields
  const [prodName, setProdName] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodCostPrice, setProdCostPrice] = useState(0);
  const [prodStock, setProdStock] = useState(0);
  const [prodMinAlert, setProdMinAlert] = useState(5);
  const [prodImage, setProdImage] = useState('');
  const [prodCategory, setProdCategory] = useState('');

  const [catName, setCatName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Harap pilih file gambar (JPG, PNG, WEBP, dll)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProdImage(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const fetchData = async () => {
    if (!currentStoreId) return;
    try {
      const prodRes = await api.get(`/products?storeId=${currentStoreId}`);
      setProducts(prodRes.products);

      const catRes = await api.get(`/products/categories?storeId=${currentStoreId}`);
      setCategories(catRes.categories);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentStoreId]);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdBarcode('');
    setProdDesc('');
    setProdPrice(0);
    setProdCostPrice(0);
    setProdStock(0);
    setProdMinAlert(5);
    setProdImage('');
    setImageInputMode('file');
    setProdCategory(categories[0]?.id || '');
    setIsProductModalOpen(true);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdBarcode(prod.barcode || '');
    setProdDesc(prod.description || '');
    setProdPrice(Number(prod.price));
    setProdCostPrice(Number(prod.costPrice));
    setProdStock(prod.stock);
    setProdMinAlert(prod.minStockAlert);
    const imgVal = prod.image || '';
    setProdImage(imgVal);
    if (imgVal.startsWith('http://') || imgVal.startsWith('https://')) {
      setImageInputMode('url');
    } else {
      setImageInputMode('file');
    }
    setProdCategory(prod.categoryId || '');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId || !prodName || prodPrice <= 0) return;

    const payload = {
      name: prodName,
      barcode: prodBarcode || undefined,
      description: prodDesc || undefined,
      price: Number(prodPrice),
      costPrice: Number(prodCostPrice),
      stock: Number(prodStock),
      minStockAlert: Number(prodMinAlert),
      image: prodImage || undefined,
      categoryId: prodCategory || undefined,
      storeId: currentStoreId,
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setIsProductModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan produk');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus produk');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId || !catName) return;

    try {
      await api.post('/products/categories', {
        name: catName,
        storeId: currentStoreId,
      });
      setIsCategoryModalOpen(false);
      setCatName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kategori');
    }
  };

  const filteredProducts = products.filter((prod) =>
    prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prod.barcode && prod.barcode.includes(searchTerm))
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Katalog Produk</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kelola daftar menu, harga, persediaan produk retail</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="font-bold flex items-center gap-1.5"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <Tag className="h-4 w-4" />
            <span>Kategori</span>
          </Button>

          <Button
            variant="primary"
            className="font-bold flex items-center gap-1.5"
            onClick={openAddProduct}
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Tambah Produk</span>
          </Button>
        </div>
      </div>

      {/* Search Filter Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20">
        <CardContent className="p-4 flex items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 text-slate-500 h-4.5 w-4.5" />
            <input
              type="text"
              placeholder="Cari nama produk atau scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs pl-10 pr-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : filteredProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Nama Produk / SKU</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-right">Harga Modal</TableHead>
                  <TableHead className="text-center">Stok</TableHead>
                  <TableHead className="text-center w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((prod) => (
                  <TableRow key={prod.id}>
                    <TableCell>
                      {prod.image ? (
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-800" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-600">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="block font-bold text-slate-900 dark:text-white text-xs">{prod.name}</span>
                      <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                        {prod.barcode || 'Tidak ada Barcode'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {prod.category?.name || 'Uncategorized'}
                      </span>
                    </TableCell>

                    <TableCell className="text-right font-bold text-slate-900 dark:text-white text-xs">
                      {formatCurrency(Number(prod.price))}
                    </TableCell>

                    <TableCell className="text-right font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {formatCurrency(Number(prod.costPrice))}
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge 
                        variant={
                          prod.stock <= 0 
                            ? 'danger' 
                            : prod.stock <= prod.minStockAlert 
                            ? 'warning' 
                            : 'success'
                        }
                      >
                        {prod.stock} pcs
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => openEditProduct(prod)}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-md cursor-pointer transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-md cursor-pointer transition-colors"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Tidak ada produk ditemukan.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Product Modal Dialog */}
      <Dialog
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Ubah Informasi Produk' : 'Tambah Produk Baru'}
        description="Lengkapi detail item untuk katalog penjualan POS kasir"
      >
        <form onSubmit={handleSaveProduct} className="flex flex-col gap-4">
          <Input
            id="pName"
            type="text"
            label="Nama Produk"
            placeholder="Espresso Latte"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="pBarcode"
              type="text"
              label="Barcode / SKU"
              placeholder="888001"
              value={prodBarcode}
              onChange={(e) => setProdBarcode(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pCategory" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Kategori
              </label>
              <select
                id="pCategory"
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-300 rounded-lg text-xs p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="pPrice"
              type="number"
              label="Harga Jual (IDR)"
              value={prodPrice || ''}
              onChange={(e) => setProdPrice(Number(e.target.value))}
              required
            />
            <Input
              id="pCost"
              type="number"
              label="Harga Modal (IDR)"
              value={prodCostPrice || ''}
              onChange={(e) => setProdCostPrice(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="pStock"
              type="number"
              label="Persediaan Awal (Stok)"
              value={prodStock || ''}
              onChange={(e) => setProdStock(Number(e.target.value))}
              required
            />
            <Input
              id="pMinStock"
              type="number"
              label="Batas Minimum Alarm"
              value={prodMinAlert || ''}
              onChange={(e) => setProdMinAlert(Number(e.target.value))}
              required
            />
          </div>

          {/* Gambar Produk Field */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Gambar Produk <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setImageInputMode('file')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${
                    imageInputMode === 'file'
                      ? 'bg-blue-600 text-white font-medium shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('url')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${
                    imageInputMode === 'url'
                      ? 'bg-blue-600 text-white font-medium shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Link className="w-3 h-3" />
                  <span>URL Web</span>
                </button>
              </div>
            </div>

            {imageInputMode === 'file' ? (
              <div className="flex flex-col gap-2">
                {prodImage ? (
                  <div className="relative group w-full h-36 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center">
                    <img
                      src={prodImage}
                      alt="Preview Produk"
                      className="w-full h-full object-contain p-2"
                    />
                    <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors shadow-lg">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Ganti Gambar</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setProdImage('')}
                        className="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="w-full h-32 border-2 border-dashed border-slate-800 hover:border-blue-500 bg-slate-950/60 hover:bg-slate-900/40 rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all group">
                    <div className="w-10 h-10 rounded-full bg-slate-900 group-hover:bg-blue-500/10 border border-slate-800 group-hover:border-blue-500/30 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-300 group-hover:text-white">
                      Klik untuk upload gambar dari perangkat Anda
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Format: PNG, JPG, WEBP (Otomatis dioptimasi)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            ) : (
              <Input
                id="pImage"
                type="url"
                label=""
                placeholder="https://images.unsplash.com/..."
                value={prodImage}
                onChange={(e) => setProdImage(e.target.value)}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pDesc" className="text-xs font-semibold text-slate-300">
              Deskripsi Singkat
            </label>
            <textarea
              id="pDesc"
              placeholder="Detail racikan kopi espresso dengan..."
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-350 rounded-lg text-xs p-3 min-h-[60px] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProductModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="font-bold"
              disabled={!prodName || prodPrice <= 0}
            >
              Simpan Produk
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Buat Kategori Baru"
        description="Definisikan kategori baru untuk merapikan pembagian produk"
      >
        <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
          <Input
            id="cName"
            type="text"
            label="Nama Kategori"
            placeholder="Minuman Dingin"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <div className="flex gap-3 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="font-bold"
              disabled={!catName}
            >
              Simpan Kategori
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
