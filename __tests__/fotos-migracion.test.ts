/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(process.cwd(), 'migrations', '012_productos_heredar_imagen.sql'),
  'utf8'
);

describe('migración 012 — trigger de herencia de foto', () => {
  it('29. define el índice, la función y el trigger con la normalización correcta', () => {
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
    expect(sql).toContain('upper(btrim(codigo))');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.productos_heredar_imagen()');
    expect(sql).toContain('BEFORE INSERT');
    expect(sql).toContain('NEW.imagen_url IS NOT NULL OR NEW.public_id IS NOT NULL');
    expect(sql).toContain('p.public_id IS NOT NULL');
    expect(sql).toContain('DROP TRIGGER IF EXISTS');
  });

  it('30. no toca los esquemas de WinFac ni destruye datos', () => {
    expect(sql).not.toContain('vida.');
    expect(sql).not.toContain('sanjh.');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('ALTER TABLE');
    expect(sql).not.toContain('DELETE');
  });
});
