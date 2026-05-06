/**
 * @jest-environment node
 */

const getServerSession = jest.fn();

jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { GET as getHealth } from '../../app/api/catalog-image/health/route';
import { POST as postJob } from '../../app/api/catalog-image/job/route';
import { GET as getJob } from '../../app/api/catalog-image/job/[id]/route';

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { name: 'test' } });
  process.env.CATALOG_SERVICE_URL = 'http://fake-service';
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  delete (global as any).fetch;
});

test('GET /health → 200 cuando microservicio responde ok', async () => {
  (global as any).fetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) });
  const res = await getHealth();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ status: 'ok' });
});

test('GET /health → 503 cuando microservicio lanza error', async () => {
  (global as any).fetch.mockRejectedValue(new Error('ECONNREFUSED'));
  const res = await getHealth();
  expect(res.status).toBe(503);
});

test('POST /job → retorna job_id del microservicio', async () => {
  (global as any).fetch.mockResolvedValue({ ok: true, json: async () => ({ job_id: 'abc-123' }) });
  const formData = new FormData();
  formData.append('product_code', 'J09A10');
  formData.append('packing_text', '4 Sets / Caja');
  const req = { formData: async () => formData } as any;
  const res = await postJob(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.job_id).toBe('abc-123');
});

test('GET /job/[id] → retorna estado del job', async () => {
  (global as any).fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'processing', step: 'removing_bg', result_url: null, error: null }),
  });
  const req = {} as Request;
  const res = await getJob(req, { params: { id: 'abc-123' } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('processing');
  expect(body.step).toBe('removing_bg');
});
