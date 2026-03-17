import { neon } from '@neondatabase/serverless';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Please set it in your .env file.');
  process.exit(1);
}

const sql = neon(connectionString);

async function seed() {
  console.log('Starting seed process...');

  try {
    console.log('Creating schemas and tables...');

    // Drop existing tables avoiding parameterized table names
    await sql`DROP TABLE IF EXISTS catalogo_items, catalogos, despachos, usuario_empresa, inventario_conteo, ubicaciones_bodega, productos, usuarios, empresas CASCADE`;

    // --- ENUMS & TABLES CREATION ---
    await sql`
      CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        codigo TEXT NOT NULL,
        nroingreso TEXT,
        saldo INTEGER DEFAULT 0,
        umed TEXT,
        cif DECIMAL(12,4),
        costo DECIMAL(12,2),
        prcventa DECIMAL(12,2),
        prcminimo DECIMAL(12,2),
        cantcaja INTEGER DEFAULT 1,
        pesocaja DECIMAL(10,4) DEFAULT 0,
        cubicaja DECIMAL(10,4) DEFAULT 0,
        detalle TEXT,
        imagen_url TEXT,
        es_nuevo BOOLEAN DEFAULT FALSE,
        fecha_ingreso TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, codigo)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ubicaciones_bodega (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        codigo TEXT NOT NULL,
        ubicacion TEXT NOT NULL,
        detalle TEXT,
        cantcaja INTEGER DEFAULT 1,
        saldo INTEGER DEFAULT 0,
        saldocajas DECIMAL(10,2),
        fisico DECIMAL(10,2),
        diferencia DECIMAL(10,2),
        observaciones TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, codigo)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        rut TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL,
        password TEXT NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS inventario_conteo (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER REFERENCES ubicaciones_bodega(id),
        empresa_id INTEGER REFERENCES empresas(id),
        fisico DECIMAL(10,2),
        diferencia DECIMAL(10,2),
        observaciones TEXT,
        contado_por INTEGER REFERENCES usuarios(id),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS usuario_empresa (
        usuario_id INTEGER REFERENCES usuarios(id),
        empresa_id INTEGER REFERENCES empresas(id),
        PRIMARY KEY (usuario_id, empresa_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS despachos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        folio TEXT,
        imagen_url TEXT NOT NULL,
        public_id TEXT,
        nombre_original TEXT,
        estado TEXT DEFAULT 'ok',
        procesado_por INTEGER REFERENCES usuarios(id),
        fecha_despacho DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS catalogos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        titulo TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS catalogo_items (
        id SERIAL PRIMARY KEY,
        catalogo_id INTEGER REFERENCES catalogos(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id),
        tipo TEXT DEFAULT 'product',
        url_media TEXT,
        orden INTEGER DEFAULT 0,
        hide_price BOOLEAN DEFAULT FALSE,
        nota_extra TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('Tables created. Inserting seed data...');

    // --- SEED DATA ---
    const [empresaSanjh, empresaVidaDigital] = await sql`
      INSERT INTO empresas (nombre, slug) VALUES 
      ('IMPORT EXPORT SANJH LTDA.', 'sanjh'),
      ('IMPORT EXPORT VIDA DIGITAL LTDA.', 'vidadigital')
      RETURNING id, slug;
    `;

    const adminHash = await bcrypt.hash('admin123', 10);
    const bodegaHash = await bcrypt.hash('bodega123', 10);
    const vendedorHash = await bcrypt.hash('venta123', 10);

    const usuarios = await sql`
      INSERT INTO usuarios (rut, nombre, rol, password) VALUES 
      ('11.111.111-1', 'Admin User', 'admin', ${adminHash}),
      ('22.222.222-2', 'Bodeguero User', 'bodeguero', ${bodegaHash}),
      ('33.333.333-3', 'Vendedor User', 'vendedor', ${vendedorHash})
      RETURNING id, rol;
    `;

    // Assign all users to both companies for testing
    for (const u of usuarios) {
      await sql`
        INSERT INTO usuario_empresa (usuario_id, empresa_id) VALUES 
        (${u.id}, ${empresaSanjh.id}),
        (${u.id}, ${empresaVidaDigital.id})
      `;
    }

    // Insert Products
    const baseProducts = [
      { code: 'A100', desc: 'Sartén Antiadherente 24cm', nuevo: true, saldo: 50 },
      { code: 'A101', desc: 'Sartén Antiadherente 28cm', nuevo: false, saldo: 0 },
      { code: 'B200', desc: 'Olla Presión 5L Acero Inox', nuevo: true, saldo: 20 },
      { code: 'C300', desc: 'Juego de Cubiertos 24 Pzas', nuevo: false, saldo: 150 },
      { code: 'D400', desc: 'Hervidor Eléctrico 1.7L', nuevo: false, saldo: 45 },
      { code: 'D401', desc: 'Batidora de Mano 300W', nuevo: false, saldo: 0 },
      { code: 'E500', desc: 'Juego de Vasos Vidrio 6 Pzas', nuevo: true, saldo: 80 },
      { code: 'F600', desc: 'Tupper Cristal Set 3', nuevo: false, saldo: 120 },
      { code: 'G700', desc: 'Cuchillo Chef 20cm', nuevo: false, saldo: 60 },
      { code: 'H800', desc: 'Cafetera Italiana 6 Tazas', nuevo: false, saldo: 30 }
    ];

    const allProducts = [];

    for (const emp of [empresaSanjh, empresaVidaDigital]) {
      const prefix = emp.id === empresaSanjh.id ? 'SJ' : 'VD';
      for (const p of baseProducts) {
        const codigo = `${prefix}-${p.code}`;
        const res = await sql`
          INSERT INTO productos (
            empresa_id, codigo, detalle, saldo, umed, cif, costo, prcventa, prcminimo, cantcaja, es_nuevo
          ) VALUES (
            ${emp.id}, ${codigo}, ${p.desc}, ${p.saldo}, 'U',
            12.5000, 15.00, 25.00, 20.00, 12, ${p.nuevo}
          )
          RETURNING id, codigo;
        `;
        allProducts.push({ emp: emp.id, id: res[0].id, codigo: res[0].codigo });

        // Insert Ubicacion for SOME products
        if (p.saldo > 0) {
          const saldocajas = p.saldo / 12; // cantcaja=12
          const ubi = `A-01-0${allProducts.length % 9}`;
          await sql`
            INSERT INTO ubicaciones_bodega (
              empresa_id, codigo, ubicacion, detalle, cantcaja, saldo, saldocajas
            ) VALUES (
              ${emp.id}, ${codigo}, ${ubi}, ${p.desc}, 12, ${p.saldo}, ${saldocajas}
            )
          `;
        }
      }

      // Insert Catalogo
      const slug = emp.id === empresaSanjh.id ? 'cat-sanjh' : 'cat-vidadigital';
      const cat = await sql`
        INSERT INTO catalogos (empresa_id, titulo, slug, descripcion) VALUES
        (${emp.id}, 'Catálogo de Temporada', ${slug}, 'Los mejores productos para el hogar.')
        RETURNING id;
      `;

      // Assign first 3 products to catalog
      const prodsForCat = allProducts.filter(p => p.emp === emp.id).slice(0, 3);
      for (let i = 0; i < prodsForCat.length; i++) {
        await sql`
          INSERT INTO catalogo_items (catalogo_id, producto_id, orden) VALUES
          (${cat[0].id}, ${prodsForCat[i].id}, ${i})
        `;
      }
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
