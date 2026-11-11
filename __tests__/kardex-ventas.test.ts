import { getServerSession } from "next-auth";
import { schemaDeEmpresa } from "@/lib/ventas-producto";

const sqlMock = jest.fn();
let GET_VENTAS: typeof import("@/app/api/kardex/ventas/route").GET;
let GET_KARDEX: typeof import("@/app/api/kardex/route").GET;

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

function sesion(rol: string | null) {
  (getServerSession as jest.Mock).mockResolvedValue(
    rol ? { user: { rol, empresas: [1] } } : null
  );
}

function req(path: string) {
  return { url: `http://localhost${path}` } as Request;
}

function mockQueries(patrones: any[], filas: any[]) {
  sqlMock.mockResolvedValueOnce(patrones).mockResolvedValueOnce(filas);
}

const URL_OK = "/api/kardex/ventas?codigo=HL-81&empresaSlug=vidadigital";

const FILA = {
  precio: 12.5,
  cajas: 2,
  unidades: 120,
  cliente: "JOHN HUARACHI",
  vendedor: "PRAVIN",
  nota: "002514",
  fecha: "2026-11-09",
};

describe("schemaDeEmpresa (whitelist)", () => {
  it("acepta solo los slugs conocidos", () => {
    expect(schemaDeEmpresa("sanjh")).toBe("sanjh");
    expect(schemaDeEmpresa("vidadigital")).toBe("vida");
    expect(schemaDeEmpresa("vida")).toBe("vida");
    expect(schemaDeEmpresa("")).toBeNull();
    expect(schemaDeEmpresa(null)).toBeNull();
    expect(schemaDeEmpresa("vida;DROP SCHEMA public")).toBeNull();
  });
});

describe("GET /api/kardex/ventas", () => {
  beforeAll(async () => {
    GET_VENTAS = (await import("@/app/api/kardex/ventas/route")).GET;
    GET_KARDEX = (await import("@/app/api/kardex/route")).GET;
  });

  beforeEach(() => {
    sqlMock.mockReset();
    sesion("admin");
  });

  it("401 sin sesion y no toca la base", async () => {
    sesion(null);
    const res = await GET_VENTAS(req(URL_OK));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("403 para bodeguero y supervisor, sin tocar la base", async () => {
    for (const rol of ["bodeguero", "supervisor"]) {
      sesion(rol);
      const res = await GET_VENTAS(req(URL_OK));
      expect(res.status).toBe(403);
    }
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("400 sin codigo, sin empresaSlug o con codigo vacio", async () => {
    expect((await GET_VENTAS(req("/api/kardex/ventas?empresaSlug=vida"))).status).toBe(400);
    expect((await GET_VENTAS(req("/api/kardex/ventas?codigo=HL-81"))).status).toBe(400);
    expect((await GET_VENTAS(req("/api/kardex/ventas?codigo=%20%20&empresaSlug=vida"))).status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("400 con empresaSlug invalido: nunca llega a SQL", async () => {
    const res = await GET_VENTAS(
      req("/api/kardex/ventas?codigo=HL-81&empresaSlug=vida%3BDROP%20SCHEMA%20public")
    );
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("200 para admin y vendedor", async () => {
    for (const rol of ["admin", "vendedor"]) {
      sesion(rol);
      mockQueries([], [FILA]);
      const res = await GET_VENTAS(req(URL_OK));
      expect(res.status).toBe(200);
    }
  });

  it("devuelve las filas mapeadas a numeros y texto", async () => {
    mockQueries([], [{ ...FILA, precio: "12.5", cajas: "1.00", unidades: "120", vendedor: "" }]);
    const res = await GET_VENTAS(req(URL_OK));
    await expect(res.json()).resolves.toEqual({
      ventas: [
        {
          fecha: "2026-11-09",
          nota: "002514",
          cliente: "JOHN HUARACHI",
          vendedor: "",
          cajas: 1,
          unidades: 120,
          precio: 12.5,
        },
      ],
    });
  });

  it("cliente null se conserva como null", async () => {
    mockQueries([], [{ ...FILA, cliente: null }]);
    const res = await GET_VENTAS(req(URL_OK));
    const body = await res.json();
    expect(body.ventas[0].cliente).toBeNull();
  });

  it("usa el esquema sanjh y la fecha como texto to_char", async () => {
    mockQueries([], [FILA]);
    await GET_VENTAS(req("/api/kardex/ventas?codigo=HL-81&empresaSlug=sanjh"));
    const queryRows = String(sqlMock.mock.calls[1][0]);
    expect(queryRows).toContain("FROM sanjh.itemdcto");
    expect(queryRows).toContain("to_char(m.fechanvt");
  });

  it("esquema vida para vidadigital", async () => {
    mockQueries([], [FILA]);
    await GET_VENTAS(req(URL_OK));
    expect(String(sqlMock.mock.calls[1][0])).toContain("FROM vida.itemdcto");
  });

  it("PARIDAD: total_ventas de /api/kardex === cantidad de filas del detalle", async () => {
    const patrones = [{ patron_nombre: "ANIL" }];
    const filas = [
      { ...FILA, precio: 10, cliente: "ANIL CHANDNANI", nota: "000003" },
      { ...FILA, precio: 20, nota: "000002", fecha: "2026-11-10" },
      { ...FILA, precio: 20, nota: "000001", fecha: "2026-11-09" },
      // misma nota y mismo producto: el JOIN la devuelve dos veces y el conteo tambien
      { ...FILA, precio: 20, nota: "000001", fecha: "2026-11-09" },
    ];

    mockQueries(patrones, filas);
    const kardex = await (await GET_KARDEX(req("/api/kardex?codigo=HL-81&empresaSlug=vidadigital"))).json();

    mockQueries(patrones, filas);
    const detalle = await (await GET_VENTAS(req(URL_OK))).json();

    expect(kardex.total_ventas).toBe(3);
    expect(detalle.ventas).toHaveLength(kardex.total_ventas);
    expect(detalle.ventas.some((v: any) => v.cliente === "ANIL CHANDNANI")).toBe(false);
  });

  it("ordena por fecha descendente y desempata por nota descendente", async () => {
    mockQueries([], [
      { ...FILA, nota: "000001", fecha: "2026-01-01" },
      { ...FILA, nota: "000002", fecha: "2026-11-09" },
      { ...FILA, nota: "000004", fecha: "2026-11-10" },
      { ...FILA, nota: "000003", fecha: "2026-11-10" },
    ]);
    const body = await (await GET_VENTAS(req(URL_OK))).json();
    expect(body.ventas.map((v: any) => `${v.fecha}/${v.nota}`)).toEqual([
      "2026-11-10/000004",
      "2026-11-10/000003",
      "2026-11-09/000002",
      "2026-01-01/000001",
    ]);
  });

  it("la fecha sale tal cual YYYY-MM-DD (sin conversion de zona)", async () => {
    mockQueries([], [{ ...FILA, fecha: "2026-11-09" }]);
    const body = await (await GET_VENTAS(req(URL_OK))).json();
    expect(body.ventas[0].fecha).toBe("2026-11-09");
  });

  it("500 si la base falla", async () => {
    sqlMock.mockRejectedValueOnce(new Error("boom"));
    const res = await GET_VENTAS(req(URL_OK));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "boom" });
  });
});
