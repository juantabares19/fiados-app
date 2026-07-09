import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL limpia el DOM entre tests automaticamente solo con `globals: true`. Como no
// activamos globals (para no tocar el tsconfig que usa Next), forzamos el cleanup
// aqui. Sin esto, multiples renders en tests consecutivos acumulan nodos y
// `getByRole` encuentra elementos duplicados.
afterEach(() => {
  cleanup();
});
