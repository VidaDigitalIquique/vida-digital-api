import { parseShipmentKey, getTopShipmentKeys } from '@/utils/shipment-logic';

describe('parseShipmentKey', () => {
  test('parses valid NROINGRESO correctly', () => {
    const result = parseShipmentKey('103-26-094488-002-GL2');
    expect(result).toEqual({ year: 26, number: 94488, raw: '26-094488' });
  });

  test('parses another valid NROINGRESO', () => {
    const result = parseShipmentKey('101-25-023892-001-GLP');
    expect(result).toEqual({ year: 25, number: 23892, raw: '25-023892' });
  });

  test('returns null for invalid format', () => {
    const result = parseShipmentKey('INVALID');
    expect(result).toBeNull();
  });
});

describe('getTopShipmentKeys', () => {
  test('returns top 3 most recent shipment keys', () => {
    const keys = [
      '101-25-023892-001-GLP',
      '103-26-094488-002-GL2',
      '103-26-094486-014-GL2',
      '101-24-011111-001-GL2',
      '103-26-094490-001-GL2',
    ];
    const result = getTopShipmentKeys(keys, 3);
    expect(result).toEqual(['26-094490', '26-094488', '26-094486']);
  });

  test('newer year always beats older year', () => {
    const keys = [
      '101-25-099999-001-GLP',
      '103-26-000001-001-GL2',
    ];
    const result = getTopShipmentKeys(keys, 2);
    expect(result[0]).toBe('26-000001');
  });

  test('handles duplicate NROINGRESO values', () => {
    const keys = [
      '103-26-094488-001-GL2',
      '103-26-094488-002-GL2',
      '103-26-094488-003-GL2',
    ];
    const result = getTopShipmentKeys(keys, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('26-094488');
  });
});
