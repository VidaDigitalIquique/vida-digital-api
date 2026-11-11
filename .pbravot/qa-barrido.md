## Barrido
- Rol del barrido: admin (99.999.991-1). Los permisos de vendedor y bodeguero van como casos (R3) y en el humo por rol.
- Excluir: /admin/importar (sincroniza o importa WinFac: reescribe la base de pruebas entera); /admin/subir-imagenes y cualquier subida de imagenes (van a Cloudinary real, ver qa-datos); botones que llamen a IA externa (categorizar, generar imagen de catalogo); enviar mensajes o notificaciones push; "Cerrar sesion" solo al final.
- En pantallas con formularios: crear solo registros con nombre que empiece por QA- y no borrar datos que no sean QA-.
- Capacidades esperadas (PRD v2 VENDEDORES + drawer; cada una debe tener un control visible y funcionar):
  1. /precios: en el drawer de un producto con ventas, "N ventas registradas" se puede pulsar y muestra la lista de ventas (cliente, precio, fecha, nota, vendedor, cantidad).
  2. Menu: opcion VENDEDORES a la derecha de ADMINISTRACION (solo admin), tambien en el menu movil.
  3. /vendedores: tabla de notas de ambas empresas con columna Empresa, estado y numero de visacion.
  4. /vendedores: filtros por vendedor, rango de fecha de venta con atajos Hoy / Esta semana / Este mes, rango de fecha de visacion, estado y empresa.
  5. /vendedores: los filtros se mantienen al salir y volver.
  6. /vendedores: clic en una nota abre el detalle con lineas (imagen, codigo, costo, % sobre el costo, cajas, precio, ganancia) y total de ganancia.
  7. /vendedores: seccion Comisiones con selector de mes, % de comision editable y guardable, tabla por vendedor y totales.
  8. /vendedores: boton Exportar descarga el informe de comisiones en .xlsx.
  9. Cerrar sesion visible en todas las pantallas.
