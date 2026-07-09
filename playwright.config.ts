import { defineConfig, devices } from '@playwright/test';

/**
 * Config de E2E para fiados-app.
 *
 * Estrategia: los specs "smoke" (carga de pagina de login) corren siempre. Los
 * specs que requieren login (fiado, abono) usan E2E_CELULAR / E2E_PIN del entorno
 * y se autodescarter (test.skip) si no estan definidos, para no romper en CI sin
 * credenciales ni BD configurada.
 *
 * El webServer levanta `npm run dev` si no hay uno corriendo; necesita .env.local
 * valido (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET) y un
 * usuario de prueba en la BD.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // un solo worker: la BD compartida no es safe bajo paralelismo
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined // si apuntamos a una URL externa, no levantamos dev local
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
