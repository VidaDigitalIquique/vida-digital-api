CREATE TABLE public.seguimientos (
  id serial PRIMARY KEY,
  empresa text NOT NULL CHECK (empresa IN ('vida', 'sanjh')),
  knumfoli text NOT NULL,
  asignado_a integer REFERENCES public.usuarios(id),
  prioridad text NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('alta', 'normal', 'baja')),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'cerrado')),
  notas_internas text,
  created_by integer REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa, knumfoli)
);

CREATE TABLE public.seguimiento_interacciones (
  id serial PRIMARY KEY,
  seguimiento_id integer NOT NULL REFERENCES public.seguimientos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('llamada', 'whatsapp', 'email', 'visita', 'nota')),
  resultado text,
  proximo_contacto date,
  creado_por integer REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
