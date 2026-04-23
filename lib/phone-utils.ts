export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 8) return digits;
  return digits.substring(digits.length - 8);
}

export function inferPaisDesdePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Orden importa: códigos más largos primero para evitar conflictos
  if (digits.startsWith('598')) return 'Uruguay';
  if (digits.startsWith('595')) return 'Paraguay';
  if (digits.startsWith('591')) return 'Bolivia';
  if (digits.startsWith('56')) return 'Chile';
  if (digits.startsWith('55')) return 'Brasil';
  if (digits.startsWith('54')) return 'Argentina';
  if (digits.startsWith('51')) return 'Perú';
  return null;
}
