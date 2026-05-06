import { render, screen } from '@testing-library/react';
import { CatalogImageClient, ImagePreview, stepLabel } from './client';

beforeEach(() => {
  (global as any).fetch = jest.fn(() => new Promise(() => {}));
});
afterEach(() => {
  delete (global as any).fetch;
});

test('muestra texto Conectando en estado inicial', () => {
  render(<CatalogImageClient />);
  expect(screen.getByText(/conectando/i)).toBeInTheDocument();
});

test('botón Generar está deshabilitado mientras conecta', () => {
  render(<CatalogImageClient />);
  expect(screen.getByRole('button', { name: /generar/i })).toBeDisabled();
});

test('stepLabel retorna la etiqueta correcta para cada step', () => {
  expect(stepLabel('removing_bg')).toBe('Removiendo fondo…');
  expect(stepLabel('generating_image')).toBe('Generando imagen con IA…');
  expect(stepLabel('composing')).toBe('Componiendo imagen…');
  expect(stepLabel('uploading')).toBe('Subiendo a Cloudinary…');
  expect(stepLabel(null)).toBe('');
});

test('ImagePreview muestra img con el src correcto', () => {
  render(<ImagePreview result_url="https://example.com/img.jpg" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.jpg');
});
