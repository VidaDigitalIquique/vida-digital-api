// Mock auth
jest.mock("next-auth", () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock DB
jest.mock("@/lib/db", () => ({
  sql: jest.fn()
}));
// Mock Cloudinary
jest.mock("@/lib/cloudinary", () => ({
  uploadImage: jest.fn()
}));

import { getServerSession } from "next-auth";
import { sql } from "@/lib/db";
import { uploadImage } from "@/lib/cloudinary";

// We'll use require to load it more dynamically
const { POST } = require("./route");

describe("POST /api/productos/upload", () => {
  it("returns 401 if user is not authorized", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const request = new Request("http://localhost/api/productos/upload", {
      method: "POST",
      body: JSON.stringify({ productoId: 1, imageBase64: "data:image/png;base64,..." })
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 200 with image_url if user is admin and data is valid", async () => {
     (getServerSession as jest.Mock).mockResolvedValue({
       user: { id: 1, rol: 'admin', empresas: [1] }
     });
     (uploadImage as jest.Mock).mockResolvedValue({
       secure_url: "https://res.cloudinary.com/demo/image/upload/productos/VD-DC-30HE.png",
       public_id: "productos/VD-DC-30HE",
     });

     const request = new Request("http://localhost/api/productos/upload", {
       method: "POST",
       body: JSON.stringify({
         productoId: 1,
         imageBase64: "data:image/png;base64,fake-data",
         codigo: "VD-DC-30HE",
       })
     });

     const response = await POST(request);
     expect(response.status).toBe(200);
     const body = await response.json();
     expect(body).toHaveProperty("imagen_url");
     expect(body).toHaveProperty("public_id");
     // UPDATE por codigo normalizado: valor interpolado intacto en el indice 3
     expect(sql).toHaveBeenCalledTimes(1);
     expect((sql as unknown as jest.Mock).mock.calls[0][3]).toBe("VD-DC-30HE");
  });

  it("33. el WHERE compara el codigo normalizado con upper(btrim())", async () => {
    (sql as unknown as jest.Mock).mockClear();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 1, rol: 'admin', empresas: [1] }
    });
    (uploadImage as jest.Mock).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/productos/VD-DC-30HE.png",
      public_id: "productos/VD-DC-30HE",
    });

    const request = new Request("http://localhost/api/productos/upload", {
      method: "POST",
      body: JSON.stringify({ productoId: 1, imageBase64: "data:image/png;base64,fake-data", codigo: "VD-DC-30HE" })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const [strings] = (sql as unknown as jest.Mock).mock.calls[0];
    expect(strings.join("?")).toContain("upper(btrim(codigo))");
    expect((sql as unknown as jest.Mock).mock.calls[0][3]).toBe("VD-DC-30HE");
  });

  it("34. codigo con espacios llega intacto al valor interpolado", async () => {
    (sql as unknown as jest.Mock).mockClear();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 1, rol: 'admin', empresas: [1] }
    });
    (uploadImage as jest.Mock).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/productos/CH-002%20CH-003.png",
      public_id: "productos/CH-002 CH-003",
    });

    const request = new Request("http://localhost/api/productos/upload", {
      method: "POST",
      body: JSON.stringify({ productoId: 1, imageBase64: "data:image/png;base64,fake-data", codigo: " CH-002 CH-003 " })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect((sql as unknown as jest.Mock).mock.calls[0][3]).toBe(" CH-002 CH-003 ");
  });
});
