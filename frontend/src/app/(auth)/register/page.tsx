'use client';

import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/useAuthStore';
import { api } from '../../../lib/api';
import Button from '../../../components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Shield } from 'lucide-react';

function RegisterContent() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Google Identity Services Script
  useEffect(() => {
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-gsi-client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setScriptLoaded(true);
    };
    document.body.appendChild(script);
  }, []);

  // Initialize and Render Google Sign-in Button for registration
  useEffect(() => {
    if (scriptLoaded) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).google) {
          (window as any).google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1082643534346-placeholder.apps.googleusercontent.com',
            callback: handleGoogleRegisterSuccess,
          });

          const container = document.getElementById('google-register-button-container');
          if (container) {
            (window as any).google.accounts.id.renderButton(
              container,
              { theme: 'filled_blue', size: 'large', width: 380, shape: 'rectangular', text: 'signup_with' }
            );
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scriptLoaded]);

  // Handle Google Register Success
  const handleGoogleRegisterSuccess = async (response: any) => {
    setIsLoading(true);
    setError('');
    try {
      const googleToken = response.credential;
      const res = await api.post('/auth/google', { token: googleToken });
      
      login(res.user, res.token, res.stores || []);

      if (res.user.status === 'ACTIVE') {
        router.push('/dashboard');
      } else {
        router.push('/pending-approval');
      }
    } catch (err: any) {
      console.error('[Google Register Error]', err);
      setError(err.message || 'Pendaftaran akun Google gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Mock Google Register for local development testing
  const triggerMockGoogleRegister = async (mockToken: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/google', { token: mockToken });
      
      login(response.user, response.token, response.stores || []);

      if (response.user.status === 'ACTIVE') {
        router.push('/dashboard');
      } else {
        router.push('/pending-approval');
      }
    } catch (err: any) {
      console.error('[Mock Google Register Error]', err);
      setError(err.message || 'Simulasi pendaftaran gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-md relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-2.5 rounded-lg text-white font-black text-xl">KM</div>
          </div>
          <CardTitle className="text-xl font-extrabold text-white">Daftar Akun Owner Baru</CardTitle>
          <CardDescription className="text-slate-400">
            KasirMu memerlukan Google Sign-In untuk keamanan akun owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-6 py-4 items-center justify-center">
            {/* Google Signup Button Container */}
            <div id="google-register-button-container" className="w-full flex justify-center min-h-[46px]" />
            
            <p className="text-center text-[11px] text-slate-500 px-4 leading-relaxed">
              Dengan mendaftar, Anda menyetujui Syarat dan Ketentuan serta Kebijakan Privasi dari KasirMu SmartPOS.
            </p>

            {/* Fallback Mock Google Login for local testing/dev */}
            {process.env.NODE_ENV === 'development' && (
              <div className="w-full flex flex-col gap-2 mt-4 border-t border-slate-800 pt-4">
                <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500 justify-center font-bold tracking-wider uppercase">
                  <span className="h-[1px] flex-1 bg-slate-800" />
                  <span>ATAU SIMULASI DEVELOMENT</span>
                  <span className="h-[1px] flex-1 bg-slate-800" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => triggerMockGoogleRegister('mock_owner_' + Math.floor(Math.random() * 1000))}
                    className="w-full text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white text-xs font-bold py-2 cursor-pointer"
                    disabled={isLoading}
                  >
                    Simulasi Daftar Owner Baru
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Sudah memiliki akun?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold hover:underline">
              Masuk
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-slate-950 px-4 py-12">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-slate-800" />
          <div className="h-4 w-28 bg-slate-800 rounded" />
        </div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
