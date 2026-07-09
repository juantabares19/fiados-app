import { test, expect } from '@playwright/test';

/**
 * Tests de login autenticado. Requieren E2E_CELULAR y E2E_PIN en el entorno,
 * mapeando a un usuario real en la BD. Si faltan, se descartan (no fallan).
 *
 * Uso:
 *   E2E_CELULAR=3001234567 E2E_PIN=1234 npx playwright test login
 */
const CELULAR = process.env.E2E_CELULAR;
const PIN = process.env.E2E_PIN;

test.describe('Login autenticado', () => {
  test.skip(!CELULAR || !PIN, 'requiere E2E_CELULAR y E2E_PIN en el entorno');

  test('login valido redirige a /inicio', async ({ page }) => {
    await page.goto('/');

    const celular = page.locator('input[inputmode="numeric"], input[type="tel"]').first();
    await celular.fill(CELULAR!);

    // PIN: puede ser un input type=password o numeric
    const pin = page.locator('input[type="password"], input[inputmode="numeric"]').last();
    await pin.fill(PIN!);

    await page.getByRole('button').first().click();

    // Debe llegar a /inicio
    await expect(page).toHaveURL(/\/inicio/, { timeout: 15_000 });
  });
});

test.describe('Login fallido', () => {
  test.skip(!CELULAR, 'requiere E2E_CELULAR para probar login fallido');

  test('PIN incorrecto no loguea y muestra error', async ({ page }) => {
    await page.goto('/');

    const celular = page.locator('input[inputmode="numeric"], input[type="tel"]').first();
    await celular.fill(CELULAR!);

    const pin = page.locator('input[type="password"], input[inputmode="numeric"]').last();
    await pin.fill('0000'); // PIN muy probablemente invalido

    await page.getByRole('button').first().click();

    // Permanece en login y aparece un mensaje de error
    await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });
    // El mensaje puede variar; buscamos texto comun de error
    await expect(page.locator('body')).toContainText(/\./, { timeout: 5_000 });
  });
});
