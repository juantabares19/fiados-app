import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renderiza el texto del children', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('NO setea type explicito (getAttribute=null)', () => {
    // HALLAZGO: el componente no añade type="button". getAttribute devuelve null,
    // pero el default IDL del navegador para <button> sin type es "submit", asi
    // que dentro de un <form> este botón dispararía submit. No lo cambiamos aqui
    // (alcance: tests); se documenta para una futura limpieza (añadir
    // type="button" por defecto en el componente).
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('type');
  });

  it('ejecuta onClick al hacer click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('NO ejecuta onClick si esta disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click
      </Button>
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('aplica clases base de accesibilidad (min 44x44 + focus ring)', () => {
    render(<Button>X</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('focus:ring-2');
  });

  it('aplica la variante primary por defecto', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button').className).toContain('bg-blue-600');
  });

  it('aplica variantes explicitas', () => {
    const { rerender } = render(<Button variant="success">X</Button>);
    expect(screen.getByRole('button').className).toContain('bg-green-600');

    rerender(<Button variant="danger">X</Button>);
    expect(screen.getByRole('button').className).toContain('bg-red-600');

    rerender(<Button variant="outline">X</Button>);
    expect(screen.getByRole('button').className).toContain('border-gray-300');
  });

  it('aplica tamaños', () => {
    const { rerender } = render(<Button size="sm">X</Button>);
    expect(screen.getByRole('button').className).toContain('h-11');

    rerender(<Button size="md">X</Button>);
    expect(screen.getByRole('button').className).toContain('h-12');

    rerender(<Button size="lg">X</Button>);
    expect(screen.getByRole('button').className).toContain('h-14');
  });

  it('permite sobreescribir clases via className', () => {
    render(<Button className="mi-clase">X</Button>);
    expect(screen.getByRole('button').className).toContain('mi-clase');
  });

  it('expone el ref al elemento button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>X</Button>);
    expect(ref.current?.tagName).toBe('BUTTON');
  });
});
