/**
 * @jest-environment jsdom
 *
 * Flag OFF: red de seguridad, comportamiento actual (URL fabricada) + encodeURIComponent.
 */
jest.mock('@/config/feature-flags.json', () => ({
  __esModule: true,
  default: { 'fix-d11-imagen-producto': false },
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

describe('ImageWithFallback — flag OFF (comportamiento actual)', () => {
  test('sin src: mantiene la URL fabricada', () => {
    render(<ImageWithFallback src={null} codigo="25004" empresaSlug="vida" />);
    expect(screen.getByTestId('next-image').getAttribute('src')).toMatch(
      /^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\/q_auto,w_1200,c_limit\/vida\/25004\.jpeg$/,
    );
  });

  test('codigo con "&": la URL fabricada queda codificada (evita el 400)', () => {
    render(<ImageWithFallback src={null} codigo="V-001PRO&V-977" empresaSlug="vida" />);
    const src = screen.getByTestId('next-image').getAttribute('src') || '';
    expect(src).toContain('V-001PRO%26V-977.jpeg');
    expect(src).not.toContain('V-001PRO&V-977');
  });

  test('con src: transforma la URL igual que hoy', () => {
    render(
      <ImageWithFallback
        src="https://res.cloudinary.com/dxkidwxjl/image/upload/productos/25004.jpg"
        codigo="25004"
        empresaSlug="vida"
      />,
    );
    expect(screen.getByTestId('next-image').getAttribute('src')).toBe(
      'https://res.cloudinary.com/dxkidwxjl/image/upload/q_auto,w_1200,c_limit/productos/25004.jpg',
    );
  });

  test('error: placeholder como hoy', () => {
    render(<ImageWithFallback src={null} codigo="25004" empresaSlug="vida" />);
    fireEvent.error(screen.getByTestId('next-image'));
    expect(screen.getByText('25004')).toBeInTheDocument();
  });
});
