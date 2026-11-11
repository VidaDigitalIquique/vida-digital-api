/**
 * D1 — /catalogo/admin exige sesion y rol admin/vendedor.
 * Estado inicial: ROJO (la page solo exige sesion).
 */
const getServerSession = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

jest.mock('./client_page', () => ({
  CatalogoAdminClient: function CatalogoAdminClient() {
    return null;
  },
}));

import CatalogoAdminPage from './page';

async function run() {
  try {
    return { element: await CatalogoAdminPage(), redirect: null as string | null };
  } catch (e: any) {
    return { element: null, redirect: e.message as string };
  }
}

describe('/catalogo/admin — control de rol', () => {
  beforeEach(() => {
    getServerSession.mockReset();
  });

  it('sin sesion -> redirect /login', async () => {
    getServerSession.mockResolvedValue(null);
    const { redirect } = await run();
    expect(redirect).toBe('REDIRECT:/login');
  });

  it('bodeguero -> redirect /dashboard', async () => {
    getServerSession.mockResolvedValue({ user: { rol: 'bodeguero' } });
    const { redirect } = await run();
    expect(redirect).toBe('REDIRECT:/dashboard');
  });

  it.each(['admin', 'vendedor'])('%s -> renderiza CatalogoAdminClient', async (rol) => {
    getServerSession.mockResolvedValue({ user: { rol } });
    const { element, redirect } = await run();
    expect(redirect).toBeNull();
    expect(element).toBeTruthy();
  });
});
