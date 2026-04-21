'use client';

import { useEffect, useState } from 'react';
import flags from '@/config/feature-flags.json';

type Props = { kcodclie: string | number; className?: string; _flagOverride?: boolean };

export function ClienteStars({ kcodclie, className, _flagOverride }: Props) {
  const enabled = _flagOverride !== undefined
    ? _flagOverride
    : (flags as any)['cliente-stars-visible'];
  const [estrellas, setEstrellas] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    fetch(`/api/clientes/${kcodclie}/rating`)
      .then(res => {
        if (!res.ok) throw new Error('error');
        return res.json();
      })
      .then(data => setEstrellas(data.estrellas))
      .catch(() => setEstrellas(0));
  }, [kcodclie, enabled]);

  if (!enabled) return null;

  if (estrellas === null) {
    return (
      <span className={className}>
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className="text-gray-300">★</span>
        ))}
      </span>
    );
  }

  if (estrellas === 0) return null;

  return (
    <span className={className}>
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          data-filled={i < estrellas ? 'true' : 'false'}
          className={i < estrellas ? 'text-yellow-400' : 'text-gray-300'}
        >
          ★
        </span>
      ))}
    </span>
  );
}
