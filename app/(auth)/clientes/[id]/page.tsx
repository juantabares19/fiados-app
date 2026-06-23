'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ClienteConSaldo } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useUsuario } from '@/hooks/useUsuario';
import { formatearMoneda, formatearFechaCorta, formatearHora, calcularEstadoMora } from '@/lib/utils';
import { generarMensajeEstadoCuenta, generarMensajeRecordatorio, abrirWhatsApp } from '@/lib/whatsapp';
import { generarEstadoCuentaPDF, generarDeudaActivaPDF, compartirODescargarPDF, type MovimientoPDF, type ResumenPDF } from '@/lib/pdf';
import { useConfig } from '@/contexts/ConfigContext';
import Link from 'next/link';

interface DetalleProducto {
  id: string;
  producto: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
}

interface Fiado {
  id: string;
  cliente_id: string;
  tipo: 'fiado';
  total: number;
  created_at: string;
  usuario_nombre: string;
  quien_pidio: 'cliente' | 'familiar';
  familiar: string | null;
  nota: string | null;
  puede_cancelar: boolean;
  detalles: DetalleProducto[];
}

interface Abono {
  id: string;
  cliente_id: string;
  tipo: 'abono';
  monto: number;
  metodo_pago: string;
  created_at: string;
  usuario_nombre: string;
  nota: string | null;
}

type Movimiento = Fiado | Abono;

export default function ClientePerfilPage() {
  const params = useParams();
  const router = useRouter();
  const { esDueño } = useUsuario();
  const { config } = useConfig();
  const nombreTienda = config?.nombre_tienda ?? 'Mi Tienda';
  const [cliente, setCliente] = useState<ClienteConSaldo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarModalBloqueo, setMostrarModalBloqueo] = useState(false);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [generandoPdfDeuda, setGenerandoPdfDeuda] = useState(false);
  const [pdfDeudaError, setPdfDeudaError] = useState('');

  useEffect(() => {
    const cargarCliente = async () => {
      try {
        const response = await fetch(`/api/clientes/${params.id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/clientes');
            return;
          }
          throw new Error('Error al cargar cliente');
        }
        const data = await response.json();
        setCliente(data);
      } catch (err) {
        setError('No se pudo cargar el cliente');
      } finally {
        setCargando(false);
      }
    };

    if (params.id) {
      cargarCliente();
    }
  }, [params.id, router]);

  useEffect(() => {
    if (params.id) {
      setCargandoHistorial(true);
      Promise.all([
        fetch(`/api/fiados?cliente_id=${params.id}`).then(r => r.json()),
        fetch(`/api/abonos?cliente_id=${params.id}`).then(r => r.json()),
      ])
        .then(([fiados, abonos]) => {
          const fiadosTyped: Fiado[] = (fiados || []).map((f: Fiado) => ({ ...f, tipo: 'fiado' as const }));
          const abonosTyped: Abono[] = (abonos || []).map((a: Abono) => ({ ...a, tipo: 'abono' as const }));
          const combinado: Movimiento[] = [...fiadosTyped, ...abonosTyped];
          combinado.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setMovimientos(combinado.slice(0, 15));
        })
        .catch(() => setMovimientos([]))
        .finally(() => setCargandoHistorial(false));
    }
  }, [params.id]);

  const handleBloquear = async () => {
    if (!cliente) return;
    setBloqueando(true);
    try {
      const response = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al bloquear');
      const data = await response.json();
      setCliente({ ...cliente, estado: 'bloqueado', saldo: data.saldo });
      setMostrarModalBloqueo(false);
    } catch (err) {
      alert('No se pudo bloquear el cliente');
    } finally {
      setBloqueando(false);
    }
  };

  const handleGenerarPDF = async () => {
    if (!cliente) return;
    setPdfError('');
    setGenerandoPdf(true);
    try {
      // Traer TODO el historial (la ruta pagina a 100 por página).
      const limite = 100;
      let pagina = 1;
      const todos: MovimientoPDF[] = [];
      let resumen: ResumenPDF = { total_fiado: 0, total_abonado: 0, saldo: cliente.saldo };
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch(
          `/api/clientes/${cliente.id}/historial?cliente_id=${cliente.id}&limite=${limite}&pagina=${pagina}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('No se pudo cargar el historial');
        const data = await res.json();
        todos.push(...(data.movimientos as MovimientoPDF[]));
        resumen = data.resumen as ResumenPDF;
        if (!data.total_paginas || pagina >= data.total_paginas) break;
        pagina++;
      }

      const { blob, filename } = generarEstadoCuentaPDF({
        cliente: { nombre: cliente.nombre, celular: cliente.celular },
        movimientos: todos,
        resumen,
        nombreTienda,
      });
      await compartirODescargarPDF(blob, filename);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'No se pudo generar el PDF');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleGenerarDeudaPDF = async () => {
    if (!cliente) return;
    setPdfDeudaError('');
    setGenerandoPdfDeuda(true);
    try {
      const limite = 100;
      let pagina = 1;
      const todos: MovimientoPDF[] = [];
      let resumen: ResumenPDF = { total_fiado: 0, total_abonado: 0, saldo: cliente.saldo };
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch(
          `/api/clientes/${cliente.id}/historial?cliente_id=${cliente.id}&limite=${limite}&pagina=${pagina}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('No se pudo cargar el historial');
        const data = await res.json();
        todos.push(...(data.movimientos as MovimientoPDF[]));
        resumen = data.resumen as ResumenPDF;
        if (!data.total_paginas || pagina >= data.total_paginas) break;
        pagina++;
      }
      const soloFiados = todos.filter(m => m.tipo === 'fiado');

      // LIFO: fiados más recientes primero, acumular hasta cubrir el saldo activo.
      const fiadosOrdenados = [...soloFiados].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const fiadosActivos: typeof fiadosOrdenados = [];
      let acumulado = 0;
      for (const f of fiadosOrdenados) {
        if (acumulado >= resumen.saldo) break;
        fiadosActivos.push(f);
        acumulado += f.total ?? 0;
      }
      const resumenActivo: ResumenPDF = {
        total_fiado: acumulado,
        total_abonado: Math.max(0, acumulado - resumen.saldo),
        saldo: resumen.saldo,
      };

      const { blob, filename } = generarDeudaActivaPDF({
        cliente: { nombre: cliente.nombre, celular: cliente.celular },
        movimientos: fiadosActivos,
        resumen: resumenActivo,
        nombreTienda,
      });
      await compartirODescargarPDF(blob, filename);
    } catch (err) {
      setPdfDeudaError(err instanceof Error ? err.message : 'No se pudo generar el PDF');
    } finally {
      setGenerandoPdfDeuda(false);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card className="p-6 animate-pulse">
          <div className="h-24 bg-gray-200 rounded" />
        </Card>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">{error || 'Cliente no encontrado'}</p>
        <Button onClick={() => router.push('/clientes')}>Volver a clientes</Button>
      </div>
    );
  }

  const tieneSaldo = cliente.saldo > 0;
  const estaBloqueado = cliente.estado === 'bloqueado';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/clientes')}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h1>
          {cliente.apodo && <p className="text-gray-500">"{cliente.apodo}"</p>}
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.036 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>{cliente.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</span>
        </div>
        <div className="text-gray-600">
          <span className="font-medium">Tope:</span> {formatearMoneda(cliente.tope_credito)}
        </div>
        {cliente.familiares && (
          <div className="text-gray-600">
            <span className="font-medium">Familiares:</span> {cliente.familiares}
          </div>
        )}
      </Card>

      <Card className="p-6 text-center">
        <p className="text-sm text-gray-500 mb-2">SALDO PENDIENTE</p>
        <p className={`text-4xl font-bold ${tieneSaldo ? 'text-red-600' : 'text-green-600'}`}>
          {formatearMoneda(cliente.saldo)}
        </p>
        {cliente.estado_mora && cliente.estado_mora !== 'al_dia' && (
          <Badge className={`mt-2 ${calcularEstadoMora(cliente.saldo, cliente.dias_sin_movimiento || 0).bgColor} ${calcularEstadoMora(cliente.saldo, cliente.dias_sin_movimiento || 0).color}`}>
            {calcularEstadoMora(cliente.saldo, cliente.dias_sin_movimiento || 0).emoji} {cliente.estado_mora === 'critico' ? 'Crítico' : 'Moroso'} ({(cliente.dias_sin_movimiento || 0)} días)
          </Badge>
        )}
        {cliente.estado_mora === 'al_dia' && !tieneSaldo && (
          <Badge variant="success" className="mt-2 bg-green-50 text-green-600">🟢 Al día</Badge>
        )}
        {estaBloqueado && (
          <Badge variant="neutral" className="mt-2">BLOQUEADO</Badge>
        )}
      </Card>

      {!estaBloqueado && (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/fiados/nuevo?cliente=${cliente.id}`}>
            <Button variant="primary" className="w-full h-14">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              + Fiado
            </Button>
          </Link>
          <Link href={`/abonos/nuevo?cliente=${cliente.id}`}>
            <Button variant="success" className="w-full h-14">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              + Abono
            </Button>
          </Link>
        </div>
      )}
      {estaBloqueado && tieneSaldo && (
        <Link href={`/abonos/nuevo?cliente=${cliente.id}`}>
          <Button variant="success" className="w-full h-14">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            + Abono (Pagar deuda)
          </Button>
        </Link>
      )}

      <Button
        variant="outline"
        className="w-full h-12"
        onClick={() => setMostrarModalWhatsApp(true)}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Enviar por WhatsApp
      </Button>

      <Button
        variant="outline"
        className="w-full h-12"
        onClick={handleGenerarPDF}
        disabled={generandoPdf}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {generandoPdf ? 'Generando PDF...' : 'Estado de cuenta (PDF)'}
      </Button>
      {pdfError && (
        <p className="text-red-600 text-sm text-center">{pdfError}</p>
      )}
      {tieneSaldo && (
        <>
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={handleGenerarDeudaPDF}
            disabled={generandoPdfDeuda}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {generandoPdfDeuda ? 'Generando PDF...' : 'Deuda activa (PDF)'}
          </Button>
          {pdfDeudaError && (
            <p className="text-red-600 text-sm text-center">{pdfDeudaError}</p>
          )}
        </>
      )}

      {esDueño && !estaBloqueado && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Acciones de administrador</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/clientes/${cliente.id}/editar`}>
              <Button variant="outline" className="w-full h-12">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </Button>
            </Link>
            <Button
              variant="danger"
              className="w-full h-12"
              onClick={() => setMostrarModalBloqueo(true)}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Bloquear
            </Button>
          </div>
        </div>
      )}

      {esDueño && estaBloqueado && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <Card className="p-4 bg-orange-50 border border-orange-200">
            <p className="text-orange-800 text-sm text-center">
              Este cliente está bloqueado. Contacta al administrador para desbloquearlo.
            </p>
          </Card>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">HISTORIAL</h3>

        {cargandoHistorial && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-3 animate-pulse">
                <div className="h-16 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        )}

        {!cargandoHistorial && movimientos.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-gray-500">No hay movimientos registrados</p>
          </Card>
        )}

        {!cargandoHistorial && movimientos.length > 0 && (
          <div className="space-y-3">
            {movimientos.map((mov) => {
              if (mov.tipo === 'fiado') {
                const fiado = mov as Fiado;
                return (
                  <Card key={fiado.id} className="p-3 border-l-4 border-red-400">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold">🔴</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatearFechaCorta(fiado.created_at)} — {formatearHora(fiado.created_at)}
                          </p>
                          <p className="text-xs text-gray-500">Fiado {formatearMoneda(fiado.total)}</p>
                        </div>
                      </div>
                      <p className="font-bold text-red-600">{formatearMoneda(fiado.total)}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {fiado.detalles.map(d => `${d.producto} x${d.cantidad}`).join(', ')}
                    </p>
                    {fiado.quien_pidio === 'familiar' && fiado.familiar && (
                      <p className="text-xs text-gray-500">Pidió: {fiado.familiar}</p>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-400">Reg: {fiado.usuario_nombre}</p>
                      {fiado.puede_cancelar && (
                        <Badge variant="danger">Cancelable</Badge>
                      )}
                    </div>
                  </Card>
                );
              } else {
                const abono = mov as Abono;
                return (
                  <Card key={abono.id} className="p-3 border-l-4 border-green-400">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-bold">🟢</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatearFechaCorta(abono.created_at)} — {formatearHora(abono.created_at)}
                          </p>
                          <p className="text-xs text-gray-500">Abono {formatearMoneda(abono.monto)}</p>
                        </div>
                      </div>
                      <p className="font-bold text-green-600">{formatearMoneda(abono.monto)}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 capitalize">{abono.metodo_pago}</p>
                      <p className="text-xs text-gray-400">Reg: {abono.usuario_nombre}</p>
                    </div>
                    {abono.nota && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{abono.nota}"</p>
                    )}
                  </Card>
                );
              }
            })}
          </div>
        )}

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href={`/clientes/${cliente.id}/historial`} className="text-blue-600 hover:underline">
            Ver historial completo →
          </Link>
        </p>
      </div>

      <Modal
        isOpen={mostrarModalBloqueo}
        onClose={() => setMostrarModalBloqueo(false)}
        title={`Bloquear a ${cliente.nombre}`}
        confirmText="Sí, bloquear"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleBloquear}
      >
        <p className="mb-2">¿Estás seguro de bloquear a este cliente?</p>
        {tieneSaldo && (
          <p className="text-red-600 text-sm">
            Este cliente aún debe {formatearMoneda(cliente.saldo)}.
          </p>
        )}
      </Modal>

      <Modal
        isOpen={mostrarModalWhatsApp}
        onClose={() => setMostrarModalWhatsApp(false)}
        title="Enviar por WhatsApp"
      >
        <div className="space-y-3">
          <p className="text-gray-600 text-sm">Selecciona el mensaje que deseas enviar:</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (cliente) {
                  const msg = generarMensajeEstadoCuenta(cliente, nombreTienda);
                  abrirWhatsApp(cliente.celular, msg);
                }
                setMostrarModalWhatsApp(false);
              }}
              className="w-full p-4 text-left rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <p className="font-medium text-gray-800">Estado de cuenta</p>
              <p className="text-sm text-gray-500">Resumen de lo que debe actualmente</p>
            </button>
            <button
              onClick={() => {
                if (cliente) {
                  const msg = generarMensajeRecordatorio(cliente, nombreTienda);
                  abrirWhatsApp(cliente.celular, msg);
                }
                setMostrarModalWhatsApp(false);
              }}
              className="w-full p-4 text-left rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <p className="font-medium text-gray-800">Recordatorio de pago</p>
              <p className="text-sm text-gray-500">Mensaje amable recordando el pago</p>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}