import { saludoPorHora } from '@/lib/saludo';

describe('saludoPorHora', () => {
  const casos: [number, string][] = [
    [0, 'Buenas noches'],
    [4, 'Buenas noches'],
    [5, 'Buenos días'],
    [11, 'Buenos días'],
    [12, 'Buenas tardes'],
    [19, 'Buenas tardes'],
    [20, 'Buenas noches'],
    [23, 'Buenas noches'],
  ];

  it.each(casos)('%i -> %s', (hora, esperado) => {
    expect(saludoPorHora(hora)).toBe(esperado);
  });
});
