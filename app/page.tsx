'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const [celular, setCelular] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!celular.trim()) {
      setError('Ingresa tu número de celular');
      return;
    }

    if (!pin || pin.length !== 4) {
      setError('La clave debe ser de 4 dígitos');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: celular.trim(), pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      router.push('/inicio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Fiados App</h1>
          <p className="text-gray-500 mt-2">Control de fiados de tu tienda</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="celular" className="block text-base font-medium text-gray-700 mb-2">
                Celular
              </label>
              <input
                id="celular"
                type="tel"
                inputMode="tel"
                placeholder="300 123 4567"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                className="w-full h-14 px-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors placeholder:text-gray-400"
                autoComplete="tel"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="pin" className="block text-base font-medium text-gray-700 mb-2">
                Clave
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full h-14 px-4 text-xl text-center rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors placeholder:text-gray-300 tracking-widest"
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-14 text-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Ingresando...
                </span>
              ) : (
                'ENTRAR'
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-gray-400 text-sm mt-6">
          ¿No tienes cuenta? Habla con el dueño de la tienda
        </p>
      </div>
    </main>
  );
}