import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/ui/Modal';

describe('Modal - renderizado', () => {
  it('no renderiza nada cuando isOpen=false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="X">
        cuerpo
      </Modal>
    );
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });

  it('renderiza titulo y children cuando isOpen=true', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Confirmar">
        cuerpo del modal
      </Modal>
    );
    expect(screen.getByText('Confirmar')).toBeInTheDocument();
    expect(screen.getByText('cuerpo del modal')).toBeInTheDocument();
  });
});

describe('Modal - accesibilidad', () => {
  it('el dialog tiene role, aria-modal y aria-labelledby que apuntan al titulo', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Mi titulo">
        x
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBe('modal-title');
    // el titulo referencia ese id
    expect(screen.getByText('Mi titulo').id).toBe(labelledBy);
  });
});

describe('Modal - cierre', () => {
  it('Escape llama onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="X">
        cuerpo
      </Modal>
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('click en el overlay (fuera del dialog) llama onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose} title="X">
        cuerpo
      </Modal>
    );
    // El overlay es el primer hijo (div fixed inset-0)
    const overlay = container.firstChild as HTMLElement;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('click DENTRO del dialog NO llama onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="X">
        cuerpo
      </Modal>
    );
    await user.click(screen.getByText('cuerpo'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el boton de cancelar llama onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="X" cancelText="Volver">
        cuerpo
      </Modal>
    );
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('Modal - confirmacion', () => {
  it('el boton de confirmar llama onConfirm (texto por defecto "Confirmar")', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Modal isOpen onClose={() => {}} title="X" onConfirm={onConfirm}>
        cuerpo
      </Modal>
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('permite personalizar el texto de confirmacion', () => {
    render(
      <Modal isOpen onClose={() => {}} title="X" onConfirm={() => {}} confirmText="Sí, borrar">
        cuerpo
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeInTheDocument();
  });

  it('si no hay onConfirm, solo muestra el boton de cancelar', () => {
    render(
      <Modal isOpen onClose={() => {}} title="X">
        cuerpo
      </Modal>
    );
    // 1 solo boton (cancelar)
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('la variante danger pinta el boton de confirmar en rojo', () => {
    render(
      <Modal isOpen onClose={() => {}} title="X" onConfirm={() => {}} variant="danger">
        cuerpo
      </Modal>
    );
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar.className).toContain('bg-red-600');
  });
});

describe('Modal - bloqueo de scroll del body', () => {
  it('al abrir, body.overflow = hidden', () => {
    const { rerender } = render(
      <Modal isOpen={false} onClose={() => {}} title="X">
        cuerpo
      </Modal>
    );
    expect(document.body.style.overflow).not.toBe('hidden');

    rerender(
      <Modal isOpen onClose={() => {}} title="X">
        cuerpo
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('al cerrar, body.overflow se restaura', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} title="X">
        cuerpo
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={() => {}} title="X">
        cuerpo
      </Modal>
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Modal - focus trap', () => {
  it('al abrir, el primer elemento focusable recibe el foco', () => {
    render(
      <Modal isOpen onClose={() => {}} title="X" onConfirm={() => {}}>
        cuerpo
      </Modal>
    );
    // El primer boton focusable es "Cancelar" (esta antes en el DOM que
    // "Confirmar"). El useEffect del Modal lo enfoca al abrir.
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancelar).toHaveFocus();
  });

  it('Tab desde el ultimo focusable vuelve al primero (cicla dentro)', () => {
    // Nota: usamos fireEvent.keyDown directo en vez de user.tab() porque el
    // comportamiento de user-event con focus + preventDefault es distinto al del
    // navegador real y vuelve flaky el test en jsdom. Con fireEvent disparamos
    // el evento al handler del documento (donde el Modal escucha) sin que
    // user-event mueva el foco automaticamente.
    render(
      <Modal isOpen onClose={() => {}} title="X" onConfirm={() => {}}>
        cuerpo
      </Modal>
    );
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });

    confirmar.focus();
    expect(confirmar).toHaveFocus();

    // Disparamos Tab sobre el documento (donde el Modal tiene su listener).
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancelar).toHaveFocus();
  });

  it('Shift+Tab desde el primer focusable va al ultimo', () => {
    render(
      <Modal isOpen onClose={() => {}} title="X" onConfirm={() => {}}>
        cuerpo
      </Modal>
    );
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });

    expect(cancelar).toHaveFocus(); // foco inicial

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmar).toHaveFocus();
  });
});
