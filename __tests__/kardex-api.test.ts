import { getServerSession } from "next-auth";

const sqlMock = jest.fn();
let GET: typeof import("@/app/api/kardex/route").GET;

jest.mock("@/lib/db", () => ({
  sql: (...args: any[]) => sqlMock(...args),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

/** /api/kardex hace 2 queries: patrones excluidos y luego las filas. */
function mockQueries(patrones: any[], filas: any[]) {
  sqlMock.mockResolvedValueOnce(patrones).mockResolvedValueOnce(filas);
}

function req(qs: string) {
  return { url: `http://localhost/api/kardex?${qs}` } as Request;
}

describe("GET /api/kardex (JSON actual, sin cambios)", () => {
  beforeAll(async () => {
    const mod = await import("@/app/api/kardex/route");
    GET = mod.GET;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { rol: "admin", empresas: [1] } });
  });

  it("401 sin sesion y no toca la base", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(req("codigo=ABC&empresaSlug=sanjh"));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("400 sin codigo o empresaSlug", async () => {
    expect((await GET(req("empresaSlug=sanjh"))).status).toBe(400);
    expect((await GET(req("codigo=ABC"))).status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("usa el esquema sanjh cuando empresaSlug=sanjh", async () => {
    mockQueries([], [{ precio: 10, cliente: "A" }]);
    await GET(req("codigo=ABC&empresaSlug=sanjh"));
    const queryRows = String(sqlMock.mock.calls[1][0]);
    expect(queryRows).toContain("FROM sanjh.itemdcto");
    expect(queryRows).toContain("to_char(m.fechanvt");
  });

  it("usa el esquema vida cuando empresaSlug=vidadigital", async () => {
    mockQueries([], [{ precio: 10, cliente: "A" }]);
    await GET(req("codigo=ABC&empresaSlug=vidadigital"));
    expect(String(sqlMock.mock.calls[1][0])).toContain("FROM vida.itemdcto");
  });

  it("conserva el fallback a vida con empresaSlug=vida (lo usa /ventas/kardex)", async () => {
    mockQueries([], [{ precio: 10, cliente: "A" }]);
    await GET(req("codigo=ABC&empresaSlug=vida"));
    expect(String(sqlMock.mock.calls[1][0])).toContain("FROM vida.itemdcto");
  });

  it("devuelve el JSON completo con ventas (tres precios distintos)", async () => {
    mockQueries([], [
      { precio: 10, cliente: "A" },
      { precio: 20, cliente: "B" },
      { precio: 30, cliente: "C" },
    ]);
    const res = await GET(req("codigo=ABC&empresaSlug=sanjh"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      precio_minimo: 10,
      precio_maximo: 30,
      precio_medio: 20,
      precio_medio_status: "ok",
      total_ventas: 3,
      clientes_excluidos: 0,
    });
  });

  it("dos precios distintos: estado solo_dos y sin precio medio", async () => {
    mockQueries([], [
      { precio: 10, cliente: "A" },
      { precio: 20, cliente: "B" },
      { precio: 20, cliente: "C" },
    ]);
    const res = await GET(req("codigo=ABC&empresaSlug=sanjh"));
    await expect(res.json()).resolves.toEqual({
      precio_minimo: 10,
      precio_maximo: 20,
      precio_medio: null,
      precio_medio_status: "solo_dos",
      total_ventas: 3,
      clientes_excluidos: 0,
    });
  });

  it("sin ventas: JSON nulo actual e incluye el conteo de patrones", async () => {
    mockQueries([{ patron_nombre: "ANIL" }, { patron_nombre: "CASH" }], []);
    const res = await GET(req("codigo=ABC&empresaSlug=sanjh"));
    await expect(res.json()).resolves.toEqual({
      precio_minimo: null,
      precio_maximo: null,
      precio_medio: null,
      precio_medio_status: "sin_ventas",
      total_ventas: 0,
      clientes_excluidos: 2,
    });
  });

  it("excluye clientes por patron (case-insensitive) del conteo y los precios", async () => {
    mockQueries(
      [{ patron_nombre: "anil" }],
      [
        { precio: 999, cliente: "ANIL CHANDNANI" },
        { precio: 10, cliente: "JOHN HUARACHI" },
      ]
    );
    const res = await GET(req("codigo=ABC&empresaSlug=vidadigital"));
    await expect(res.json()).resolves.toEqual({
      precio_minimo: 10,
      precio_maximo: 10,
      precio_medio: null,
      precio_medio_status: "sin_variacion",
      total_ventas: 1,
      clientes_excluidos: 1,
    });
  });

  it("500 si la base falla", async () => {
    sqlMock.mockRejectedValueOnce(new Error("boom"));
    const res = await GET(req("codigo=ABC&empresaSlug=sanjh"));
    expect(res.status).toBe(500);
  });
});
