export const DATA_SOURCES = {
  producto: { table: 'producto', code: 'codunico', description: 'descrip', cost_usd: null, price_usd: null, qty_per_box: null },
  inventar: { table: 'inventar', code: 'codunico', stock_boxes: null, stock_units: 'stocdisp', derive_boxes_from_units: true },
  clientes: { table: 'clientes' },
  itemdcto: { table: 'itemdcto' },
  movidcto: { table: 'movidcto' }
} as const;
