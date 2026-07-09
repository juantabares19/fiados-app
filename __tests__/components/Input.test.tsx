import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Input } from '@/components/ui/Input';

describe('Input - asociacion label/input', () => {
  it('cuando hay label, el input recibe un id derivado del label', () => {
    render(<Input label="Celular" />);
    const input = screen.getByLabelText('Celular');
    expect(input.id).toBe('celular');
  });

  it('el label usa htmlFor que coincide con el id del input', () => {
    render(<Input label="Nombre completo" />);
    const label = screen.getByText('Nombre completo');
    const input = screen.getByLabelText('Nombre completo');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.id).toBe('nombre-completo'); // espacios -> guion
  });

  it('si se pasa id explicito, ese tiene prioridad sobre el derivado', () => {
    render(<Input label="X" id="mi-id" />);
    expect(screen.getByLabelText('X').id).toBe('mi-id');
  });

  it('si no hay label, no renderiza label', () => {
    render(<Input placeholder="algo" />);
    expect(screen.queryByText('algo')).not.toBeInTheDocument(); // placeholder no es texto
    expect(screen.getByPlaceholderText('algo')).toBeInTheDocument();
  });
});

describe('Input - error', () => {
  it('muestra el mensaje de error cuando se pasa', () => {
    render(<Input label="X" error="Campo requerido" />);
    expect(screen.getByText('Campo requerido')).toBeInTheDocument();
  });

  it('el input tiene borde rojo cuando hay error', () => {
    render(<Input label="X" error="mal" />);
    expect(screen.getByLabelText('X').className).toContain('border-red-500');
  });

  it('no muestra mensaje de error si no se pasa', () => {
    render(<Input label="X" />);
    expect(screen.queryByText('Campo requerido')).not.toBeInTheDocument();
  });
});

describe('Input - props nativos', () => {
  it('pasa type, placeholder y otros atributos al input', () => {
    render(
      <Input
        label="PIN"
        type="tel"
        inputMode="numeric"
        placeholder="0000"
        maxLength={4}
      />
    );
    const input = screen.getByLabelText('PIN');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('placeholder', '0000');
    expect(input).toHaveAttribute('maxlength', '4');
  });

  it('expone el ref al input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="X" ref={ref} />);
    expect(ref.current?.tagName).toBe('INPUT');
  });
});
