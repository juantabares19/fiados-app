import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renderiza su contenido', () => {
    render(<Badge>Moroso</Badge>);
    expect(screen.getByText('Moroso')).toBeInTheDocument();
  });

  it('tiene role=status para lectores de pantalla', () => {
    render(<Badge>Al día</Badge>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('aplica la variante neutral por defecto', () => {
    render(<Badge>X</Badge>);
    expect(screen.getByRole('status').className).toContain('bg-gray-100');
  });

  it('aplica las variantes explicitas', () => {
    const { rerender } = render(<Badge variant="success">X</Badge>);
    expect(screen.getByRole('status').className).toContain('bg-green-100');

    rerender(<Badge variant="warning">X</Badge>);
    expect(screen.getByRole('status').className).toContain('bg-orange-100');

    rerender(<Badge variant="danger">X</Badge>);
    expect(screen.getByRole('status').className).toContain('bg-red-100');

    rerender(<Badge variant="neutral">X</Badge>);
    expect(screen.getByRole('status').className).toContain('bg-gray-100');
  });

  it('propaga aria-label', () => {
    render(<Badge aria-label="cliente en mora">🟠</Badge>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'cliente en mora');
  });

  it('permite sobreescribir clases', () => {
    render(<Badge className="extra">X</Badge>);
    expect(screen.getByRole('status').className).toContain('extra');
  });
});
