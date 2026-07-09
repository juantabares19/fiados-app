import { test, expect } from '@playwright/test';

/**
 * Smoke tests: corren siempre, no necesitan credenciales ni BD. Solo verifican
 * que la pagina de login carga y tiene los campos esperados.
 */
test.describe('Login - smoke (sin credenciales)', () => {
  test('la pagina de login carga y muestra el formulario', async ({ page }) => {
    await page.goto('/');
    // Titulo o texto de bienvenida
    await expect(page.locator('body')).toBeVisible();
    // Hay un input para el celular (inputmode numeric o tel) y para el PIN
    const celular = page.locator('input[inputmode="numeric"], input[type="tel"]').first();
    await expect(celular).toBeVisible();
    // Boton de entrar/enviar
    await expect(page.getByRole('button')).toBeVisible();
  });

  test('no permite enviar con campos vacios', async ({ page }) => {
    await page.goto('/');
    const boton = page.getByRole('button').first();
    await boton.click();
    // No debe navegar fuera de la pagina de login
    await expect(page).toHaveURL(/\/$/);
  });
});
