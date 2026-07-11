// Fetch-based API client for the RantaiRenteng NestJS backend.
// Base URL comes from VITE_API_URL (default http://localhost:3001); every route
// lives under /api. The JWT is read from localStorage and sent as a Bearer token.

import type {
  AuditLog,
  BailoutResult,
  Group,
  Loan,
  LoginResult,
  Member,
  OnchainStatus,
  Peran,
  SavingJenis,
  SavingTransaction,
} from '../types';

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

export const DEMO_GROUP_ID =
  import.meta.env.VITE_DEMO_GROUP_ID ??
  'e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b';

const TOKEN_KEY = 'rr_token';
const MEMBER_KEY = 'rr_member';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredMember(): Member | null {
  const raw = localStorage.getItem(MEMBER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Member;
  } catch {
    return null;
  }
}

export function setStoredMember(member: Member): void {
  localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
}

export function clearStoredMember(): void {
  localStorage.removeItem(MEMBER_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'Tidak dapat terhubung ke server backend. Pastikan backend berjalan di ' +
        BASE_URL,
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || res.statusText || 'Request gagal';
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : String(message),
    );
  }

  return data as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export const api = {
  // --- Auth ---
  login(identifier: string, password: string): Promise<LoginResult> {
    return request<LoginResult>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
      auth: false,
    });
  },
  me(): Promise<Member> {
    return request<Member>('/auth/me');
  },

  // --- Members ---
  listMembers(): Promise<Member[]> {
    return request<Member[]>('/members');
  },
  getMe(): Promise<Member> {
    return request<Member>('/members/me');
  },
  getMember(id: string): Promise<Member> {
    return request<Member>(`/members/${id}`);
  },

  // --- Groups ---
  listGroups(): Promise<Group[]> {
    return request<Group[]>('/groups');
  },
  getGroup(id: string): Promise<Group> {
    return request<Group>(`/groups/${id}`);
  },

  // --- Audit logs ---
  listAuditLogs(limit = 100): Promise<AuditLog[]> {
    return request<AuditLog[]>(`/audit-logs?limit=${limit}`);
  },

  // --- KYC (Flow ①) ---
  submitKyc(payload: {
    nama: string;
    nik: string;
    noHp: string;
    alamat: string;
    pekerjaan: string;
    peran: Peran;
    ktpUrl?: string;
  }): Promise<Member> {
    return request<Member>('/kyc/submit', {
      method: 'POST',
      body: payload,
      auth: false,
    });
  },
  /** Upload a KTP image (multipart) during onboarding; returns its stored URL. */
  async uploadKtp(file: File): Promise<{ ktpUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/kyc/upload-ktp`, {
        method: 'POST',
        body: form, // browser sets multipart Content-Type + boundary
      });
    } catch {
      throw new ApiError(
        0,
        'Tidak dapat terhubung ke server backend untuk mengunggah KTP.',
      );
    }
    const text = await res.text();
    const data = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const message =
        (data && (data.message || data.error)) || res.statusText || 'Unggah gagal';
      throw new ApiError(
        res.status,
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
    return data as { ktpUrl: string };
  },
  approveKyc(id: string): Promise<Member> {
    return request<Member>(`/kyc/approve/${id}`, { method: 'POST' });
  },
  rejectKyc(id: string): Promise<Member> {
    return request<Member>(`/kyc/reject/${id}`, { method: 'POST' });
  },

  // --- Savings (Flow ④) ---
  createSaving(payload: {
    memberId: string;
    jenis: SavingJenis;
    nominal: number;
    metode?: string;
  }): Promise<SavingTransaction> {
    return request<SavingTransaction>('/savings', {
      method: 'POST',
      body: payload,
    });
  },
  listSavings(memberId: string): Promise<SavingTransaction[]> {
    return request<SavingTransaction[]>(
      `/savings?memberId=${encodeURIComponent(memberId)}`,
    );
  },

  // --- Loans (Flow ②) ---
  applyLoan(payload: {
    memberId: string;
    groupId: string;
    nominal: number;
    tujuan: string;
    tenor: number;
    cicilanBulanan?: number;
  }): Promise<Loan> {
    return request<Loan>('/loans/apply', { method: 'POST', body: payload });
  },
  sanggahLoan(id: string, alasan: string): Promise<Loan> {
    return request<Loan>(`/loans/sanggah/${id}`, {
      method: 'POST',
      body: { alasan },
    });
  },
  approveLoan(id: string): Promise<Loan> {
    return request<Loan>(`/loans/approve/${id}`, { method: 'POST' });
  },
  rejectLoan(id: string, reason?: string): Promise<Loan> {
    return request<Loan>(`/loans/reject/${id}`, {
      method: 'POST',
      body: { reason },
    });
  },
  listLoans(): Promise<Loan[]> {
    return request<Loan[]>('/loans');
  },
  getLoan(id: string): Promise<Loan> {
    return request<Loan>(`/loans/${id}`);
  },

  // --- Renteng (Flow ③) ---
  bailout(
    loanId: string,
    payload: { period?: number; gracePeriod?: number } = {},
  ): Promise<BailoutResult> {
    return request<BailoutResult>(`/renteng/${loanId}/bailout`, {
      method: 'POST',
      body: payload,
    });
  },

  // --- Admin ---
  onchainStatus(): Promise<OnchainStatus> {
    return request<OnchainStatus>('/admin/onchain-status');
  },
  bootstrapOnchain(): Promise<unknown> {
    return request('/admin/bootstrap-onchain', { method: 'POST' });
  },
};
