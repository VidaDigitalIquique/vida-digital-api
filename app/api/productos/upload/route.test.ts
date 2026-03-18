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

     // Mock implementation should return a success message eventually.
     // Currently this will FAIL because POST is not exported or the file doesn't exist.
     const request = new Request("http://localhost/api/productos/upload", {
       method: "POST",
       body: JSON.stringify({ 
         productoId: 1, 
         imageBase64: "data:image/png;base64,fake-data",
         filename: "test.png" 
       })
     });

     const response = await POST(request);
     expect(response.status).toBe(200);
     const body = await response.json();
     expect(body).toHaveProperty("imagen_url");
     expect(body).toHaveProperty("public_id");
  });
});
