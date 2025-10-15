# so-fixed.ps1 - SCRIPT CORREGIDO
$projectRoot = "inventory-app"

Write-Host "CREANDO PROYECTO EN: $projectRoot" -ForegroundColor Green

# Crear carpetas
@("", "\server", "\server\prisma", "\server\src", "\server\src\config", "\server\src\lib", "\server\src\routes", "\server\scripts", "\web", "\web\src", "\web\src\components", "\web\src\pages", "\web\src\lib") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path "$projectRoot$_" | Out-Null
}

# 1. ROOT - Archivos básicos
@"
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
"@ | Out-File -FilePath "$projectRoot\.editorconfig" -Encoding UTF8

@"
node_modules/
*/node_modules/
.env
*.log
dist/
build/
.DS_Store
server/prisma/migrations/
"@ | Out-File -FilePath "$projectRoot\.gitignore" -Encoding UTF8

# 2. SERVER - package.json
@"
{
  "name": "inventory-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:gen": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "introspect": "ts-node scripts/introspect.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "zod": "^3.22.4",
    "dotenv": "^16.3.1",
    "pg": "^8.11.3",
    "prisma": "^5.4.2",
    "@prisma/client": "^5.4.2"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "ts-node-dev": "^2.0.0",
    "@types/express": "^4.17.20",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.8.6"
  }
}
"@ | Out-File -FilePath "$projectRoot\server\package.json" -Encoding UTF8

# server/tsconfig.json
@"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
"@ | Out-File -FilePath "$projectRoot\server\tsconfig.json" -Encoding UTF8

# server/prisma/schema.prisma
@"
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model app_user {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  role         String
  passwordHash String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model app_location {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  counts    app_physical_count[]
}

model app_product_meta {
  id                 String   @id @default(cuid())
  productCode        String   @db.Text
  imageUrl           String?
  qtyPerBoxOverride  Int?
  observations       String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@index([productCode])
}

model app_physical_count {
  id              String      @id @default(cuid())
  productCode     String      @db.Text
  location_id     String
  countedBoxes    Decimal     @db.Numeric(12,2)
  countedByUserId String?
  countedAt       DateTime    @default(now())
  note            String?
  location        app_location @relation(fields: [location_id], references: [id])
  countedBy       app_user?    @relation(fields: [countedByUserId], references: [id])
  @@index([productCode])
  @@index([location_id])
}

model app_audit_log {
  id          String   @id @default(cuid())
  actorUserId String?
  action      String
  entity      String
  entityId    String
  diff        Json?
  createdAt   DateTime @default(now())
  actor       app_user? @relation(fields: [actorUserId], references: [id])
  @@index([actorUserId])
}
"@ | Out-File -FilePath "$projectRoot\server\prisma\schema.prisma" -Encoding UTF8

# server/src/config/env.ts
@"
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('4000'),
});

export const env = envSchema.parse(process.env);
"@ | Out-File -FilePath "$projectRoot\server\src\config\env.ts" -Encoding UTF8

# server/src/config/data-sources.ts
@"
export const DATA_SOURCES = {
  producto: { 
    table: 'producto', 
    code: 'codigo', 
    description: 'descripcion', 
    cost_usd: 'costo_usd', 
    price_usd: 'precio_usd', 
    qty_per_box: 'unidades_por_caja' 
  },
  inventar: { 
    table: 'inventar', 
    code: 'codigo', 
    stock_boxes: 'stock_cajas', 
    stock_units: 'stock_unidades', 
    derive_boxes_from_units: false 
  },
  clientes: { table: 'clientes' },
  itemdcto: { table: 'itemdcto' },
  movidcto: { table: 'movidcto' }
} as const;
"@ | Out-File -FilePath "$projectRoot\server\src\config\data-sources.ts" -Encoding UTF8

# server/src/lib/prisma.ts
@"
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
"@ | Out-File -FilePath "$projectRoot\server\src\lib\prisma.ts" -Encoding UTF8

# server/src/lib/sql.ts
@"
import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
"@ | Out-File -FilePath "$projectRoot\server\src\lib\sql.ts" -Encoding UTF8

# server/src/routes/health.ts
@"
import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
export default router;
"@ | Out-File -FilePath "$projectRoot\server\src\routes\health.ts" -Encoding UTF8

# server/src/routes/debug-ro.ts
@"
import { Router } from 'express';
import { query } from '../lib/sql';
import { DATA_SOURCES } from '../config/data-sources';

const router = Router();

router.get('/producto', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Product code required' });
    }
    
    const { producto } = DATA_SOURCES;
    const result = await query(
      \`SELECT * FROM \${producto.table} WHERE \${producto.code} = \$1 LIMIT 1\`, 
      [code]
    );
    
    res.json({ data: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventar', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Product code required' });
    }
    
    const { inventar } = DATA_SOURCES;
    const result = await query(
      \`SELECT * FROM \${inventar.table} WHERE \${inventar.code} = \$1 LIMIT 1\`, 
      [code]
    );
    
    res.json({ data: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
"@ | Out-File -FilePath "$projectRoot\server\src\routes\debug-ro.ts" -Encoding UTF8

# server/src/index.ts
@"
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRoutes from './routes/health';
import debugRoRoutes from './routes/debug-ro';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/ro', debugRoRoutes);

app.listen(env.PORT, () => {
  console.log(\`Server running: http://localhost:\${env.PORT}\`);
});
"@ | Out-File -FilePath "$projectRoot\server\src\index.ts" -Encoding UTF8

# server/scripts/introspect.ts
@"
import { Pool } from 'pg';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { join } from 'path';

config({ path: join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Introspectando base de datos...');
  
  const mapping = {
    producto: { table: 'producto', code: 'codigo', description: 'descripcion' },
    inventar: { table: 'inventar', code: 'codigo', stock_boxes: 'stock_cajas' }
  };

  const output = \`export const DATA_SOURCES = \${JSON.stringify(mapping, null, 2)} as const;\`;
  writeFileSync(join(__dirname, '../src/config/data-sources.ts'), output);
  
  console.log('data-sources.ts generado');
  await pool.end();
}

main().catch(console.error);
"@ | Out-File -FilePath "$projectRoot\server\scripts\introspect.ts" -Encoding UTF8

# 3. WEB - package.json
@"
{
  "name": "inventory-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.17.0",
    "axios": "^1.5.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.1.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "vite": "^4.5.0"
  }
}
"@ | Out-File -FilePath "$projectRoot\web\package.json" -Encoding UTF8

# web/tailwind.config.js
@"
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
"@ | Out-File -FilePath "$projectRoot\web\tailwind.config.js" -Encoding UTF8

# web/postcss.config.js
@"
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
"@ | Out-File -FilePath "$projectRoot\web\postcss.config.js" -Encoding UTF8

# web/index.html
@"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inventory App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"@ | Out-File -FilePath "$projectRoot\web\index.html" -Encoding UTF8

# web/src/main.tsx
@"
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
"@ | Out-File -FilePath "$projectRoot\web\src\main.tsx" -Encoding UTF8

# web/src/index.css
@"
@tailwind base;
@tailwind components;
@tailwind utilities;
"@ | Out-File -FilePath "$projectRoot\web\src\index.css" -Encoding UTF8

# web/src/App.tsx
@"
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Precios from './pages/Precios';
import Ubicacion from './pages/Ubicacion';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/precios" element={<Precios />} />
          <Route path="/ubicacion" element={<Ubicacion />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
"@ | Out-File -FilePath "$projectRoot\web\src\App.tsx" -Encoding UTF8

# web/src/pages/Dashboard.tsx
@"
import React from 'react';

export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="bg-white p-8 rounded shadow">
        <p className="text-gray-600">Coming soon...</p>
      </div>
    </div>
  );
}
"@ | Out-File -FilePath "$projectRoot\web\src\pages\Dashboard.tsx" -Encoding UTF8

# web/src/pages/Precios.tsx
@"
import React, { useState } from 'react';

export default function Precios() {
  const [search, setSearch] = useState('');

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Precios</h1>
      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 rounded mb-4"
      />
      <div className="bg-white p-8 rounded shadow">
        <p>Lista de precios aparecerá aquí</p>
      </div>
    </div>
  );
}
"@ | Out-File -FilePath "$projectRoot\web\src\pages\Precios.tsx" -Encoding UTF8

# web/src/pages/Ubicacion.tsx
@"
import React from 'react';

export default function Ubicacion() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Ubicación</h1>
      <div className="bg-white p-8 rounded shadow">
        <p>Selector de ubicación e inventario</p>
      </div>
    </div>
  );
}
"@ | Out-File -FilePath "$projectRoot\web\src\pages\Ubicacion.tsx" -Encoding UTF8

# web/src/lib/api.ts
@"
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000',
});

export const healthCheck = () => api.get('/health');
export const getProduct = (code: string) => api.get(\`/ro/producto?code=\${code}\`);
export const getInventory = (code: string) => api.get(\`/ro/inventar?code=\${code}\`);

export default api;
"@ | Out-File -FilePath "$projectRoot\web\src\lib\api.ts" -Encoding UTF8

# README.md
@"
# INVENTORY APP

## INICIO RÁPIDO

\`\`\`bash
# Terminal 1 - Server
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev

# Terminal 2 - Web  
cd web
npm install
npm run dev
\`\`\`

## CONFIGURACIÓN

1. Crear server/.env:
DATABASE_URL='tu_url_de_neon'
PORT=4000

2. URLs:
Server: http://localhost:4000
Web: http://localhost:5173
"@ | Out-File -FilePath "$projectRoot\README.md" -Encoding UTF8

# .env ejemplo
@"
DATABASE_URL='postgresql://usuario:password@ep-ejemplo.sa-east-1.aws.neon.tech/db?sslmode=require'
PORT=4000
"@ | Out-File -FilePath "$projectRoot\server\.env.example" -Encoding UTF8

Write-Host "✅ PROYECTO CREADO EN: $projectRoot" -ForegroundColor Green
Write-Host "Siguientes pasos:" -ForegroundColor Yellow
Write-Host "1. cd $projectRoot" -ForegroundColor White
Write-Host "2. Configurar server/.env con tu DATABASE_URL" -ForegroundColor White  
Write-Host "3. cd server && npm install && npx prisma generate" -ForegroundColor White
Write-Host "4. cd web && npm install" -ForegroundColor White