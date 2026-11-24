/**
 * @jest-environment jsdom
 *
 * Flag ON: sin URL fabricada, placeholder sin requests, cache de fallas en memoria.
 */
jest.mock('@/config/feature-flags.json', () => ({
  __esModule: true,
  default: { 'fix-d11-imagen-producto': true },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { fill?: boolean; unoptimized?: boolean } & Record<string, unknown>) => {
    const React = jest.requireActual('react');
    const { fill, unoptimized, ...rest } = props;
    void fill;
    void unoptimized;
    return React.createElement('img', { ...rest, 'data-testid': 'next-image' });
  },
}));

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import * as mod from '@/components/ImageWithFallback';

const reset = (mod as unknown as { __resetFallidas?: () => void }).__resetFallidas;
const URL_OK = 'https://res.cloudinary.com/dxkidwxjl/image/upload/productos/25004.jpg';
const URL_404 = 'https://res.cloudinary.com/dxkidwxjl/image/upload/productos/ROTA.jpg';

describe('ImageWithFallback — flag ON', () => {
  beforeEach(() => {
    reset?.();
  });

  test('sin src: placeholder con codigo y "Sin imagen", sin ningun <img> (0 requests)', () => {
    const { container } = render(<ImageWithFallback src={null} codigo="25004" />);
    expect(screen.getByRole('img', { name: /25004/ })).toBeInTheDocument();
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  test('src valida: renderiza la imagen transformada igual que hoy', () => {
    render(<ImageWithFallback src={URL_OK} codigo="25004" />);
    const img = screen.getByTestId('next-image');
    expect(img.getAttribute('src')).toBe(
      'https://res.cloudinary.com/dxkidwxjl/image/upload/q_auto,w_1200,c_limit/productos/25004.jpg',
    );
  });

  test('error: placeholder, y al remontar la misma src no se vuelve a pedir (cache)', () => {
    const { unmount, container } = render(<ImageWithFallback src={URL_404} codigo="ROTA" />);
    fireEvent.error(screen.getByTestId('next-image'));
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();

    unmount();
    const { container: c2 } = render(<ImageWithFallback src={URL_404} codigo="ROTA" />);
    expect(c2.querySelector('img')).toBeNull();
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
    void container;
  });

  test('src cambia tras error: se intenta la nueva URL (no queda pegado al cache)', () => {
    const { rerender } = render(<ImageWithFallback src={URL_404} codigo="ROTA" />);
    fireEvent.error(screen.getByTestId('next-image'));
    rerender(<ImageWithFallback src={URL_OK} codigo="25004" />);
    expect(screen.getByTestId('next-image').getAttribute('src')).toBe(
      'https://res.cloudinary.com/dxkidwxjl/image/upload/q_auto,w_1200,c_limit/productos/25004.jpg',
    );
  });

  test('codigo con "&" y sin imagen: placeholder, ninguna URL con & (sin 400)', () => {
    const { container } = render(
      <ImageWithFallback src={null} codigo="V-001PRO&V-977" empresaSlug="vida" />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('V-001PRO&V-977.jpg');
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
  });
});
