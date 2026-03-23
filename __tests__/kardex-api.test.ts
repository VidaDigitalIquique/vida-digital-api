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

describe("GET /api/kardex", () => {
  beforeAll(async () => {
    const mod = await import("@/app/api/kardex/route");
    GET = mod.GET;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { empresas: [1] } });
  });

  it("uses sanjh schema when empresaSlug is sanjh", async () => {
    sqlMock.mockResolvedValue([{ precio_minimo: 10, precio_maximo: 20, total_ventas: 3 }]);
    const req = { url: "http://localhost/api/kardex?codigo=ABC&empresaSlug=sanjh" } as Request;
    await GET(req);
    const [query] = sqlMock.mock.calls[0];
    expect(String(query)).toContain("FROM sanjh.itemdcto");
  });

  it("uses vida schema when empresaSlug is vidadigital", async () => {
    sqlMock.mockResolvedValue([{ precio_minimo: 10, precio_maximo: 20, total_ventas: 3 }]);
    const req = { url: "http://localhost/api/kardex?codigo=ABC&empresaSlug=vidadigital" } as Request;
    await GET(req);
    const [query] = sqlMock.mock.calls[0];
    expect(String(query)).toContain("FROM vida.itemdcto");
  });

  it("returns values when there are sales", async () => {
    sqlMock.mockResolvedValue([{ precio_minimo: 12.34, precio_maximo: 45.67, total_ventas: 9 }]);
    const req = { url: "http://localhost/api/kardex?codigo=ABC&empresaSlug=sanjh" } as Request;
    const res = await GET(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      precio_minimo: 12.34,
      precio_maximo: 45.67,
      total_ventas: 9,
    });
  });

  it("returns null/null/0 when there are no sales", async () => {
    sqlMock.mockResolvedValue([]);
    const req = { url: "http://localhost/api/kardex?codigo=ABC&empresaSlug=sanjh" } as Request;
    const res = await GET(req);
    await expect(res.json()).resolves.toEqual({
      precio_minimo: null,
      precio_maximo: null,
      total_ventas: 0,
    });
  });
});
