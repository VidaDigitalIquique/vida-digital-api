# INVENTORY APP

## INICIO RÃPIDO

\\\ash
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
\\\

## CONFIGURACIÃ“N

1. Crear server/.env:
DATABASE_URL='tu_url_de_neon'
PORT=4000

2. URLs:
Server: http://localhost:4000
Web: http://localhost:5173
