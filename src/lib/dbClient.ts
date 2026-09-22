/**
 * Standalone Local PostgreSQL & Backend API Client
 * Connects directly to local Node.js Express backend and PostgreSQL database.
 */

export interface SessionUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  aud?: string;
  created_at?: string;
}

export interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: SessionUser;
}

export interface QueryResult<T = any> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol || 'http:';
    const envUrl = import.meta.env.VITE_BACKEND_API_URL || import.meta.env.VITE_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/$/, '');
    }
    return `${protocol}//${host}:8095`;
  }
  return (import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8095').replace(/\/$/, '');
};

const API_BASE_URL = getApiBaseUrl();

export class QueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private tableName: string;
  private selectCols: string = '*';
  private filters: Array<{ col: string; op: string; val: any }> = [];
  private orderCol?: string;
  private orderAsc: boolean = true;
  private limitCount?: number;
  private isSingleResult: boolean = false;
  private isMaybeSingle: boolean = false;
  private countMode?: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    this.selectCols = columns;
    if (options?.count) {
      this.countMode = options.count;
    }
    if (options?.head) {
      this.limitCount = 0;
    }
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push({ col: column, op: 'eq', val: value });
    return this;
  }

  neq(column: string, value: any): this {
    this.filters.push({ col: column, op: 'neq', val: value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ col: column, op: 'in', val: values });
    return this;
  }

  is(column: string, value: any): this {
    this.filters.push({ col: column, op: 'is', val: value });
    return this;
  }

  or(_conditions: string): this {
    return this;
  }

  not(column: string, op: string, val: any): this {
    if (op === 'in') {
      const formatted = typeof val === 'string' ? val.replace(/^\(|\)$/g, '') : Array.isArray(val) ? val.join(',') : val;
      this.filters.push({ col: column, op: 'not.in', val: formatted });
    } else {
      this.filters.push({ col: column, op: `not.${op}`, val });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderCol = column;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): QueryBuilder<any> {
    this.isSingleResult = true;
    return this;
  }

  maybeSingle(): QueryBuilder<any> {
    this.isMaybeSingle = true;
    return this;
  }

  private buildUrl(): string {
    const url = new URL(`${API_BASE_URL}/rest/v1/${this.tableName}`);
    if (this.selectCols && this.selectCols !== '*') {
      url.searchParams.set('select', this.selectCols);
    }
    for (const f of this.filters) {
      if (f.op === 'eq') {
        url.searchParams.set(f.col, `eq.${f.val}`);
      } else if (f.op === 'neq') {
        url.searchParams.set(f.col, `neq.${f.val}`);
      } else if (f.op === 'in') {
        const list = Array.isArray(f.val) ? f.val.join(',') : f.val;
        url.searchParams.set(f.col, `in.(${list})`);
      } else if (f.op === 'not.in') {
        url.searchParams.set(f.col, `not.in.(${f.val})`);
      } else if (f.op === 'is') {
        url.searchParams.set(f.col, `is.${f.val}`);
      }
    }
    if (this.orderCol) {
      url.searchParams.set('order', `${this.orderCol}.${this.orderAsc ? 'asc' : 'desc'}`);
    }
    if (this.limitCount !== undefined) {
      url.searchParams.set('limit', String(this.limitCount));
    }
    return url.toString();
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.isSingleResult) {
        headers['Accept'] = 'application/vnd.pgrst.object+json';
      }
      if (this.countMode) {
        headers['Prefer'] = `count=${this.countMode}`;
      }

      const res = await fetch(this.buildUrl(), { headers });

      if (!res.ok) {
        const text = await res.text();
        return { data: null, error: { message: text || res.statusText }, count: null };
      }

      const range = res.headers.get('content-range');
      let count: number | null = null;
      if (range) {
        const total = range.split('/')[1];
        if (total && !isNaN(Number(total))) {
          count = Number(total);
        }
      }

      const json = await res.json();

      if (this.isSingleResult) {
        const singleItem = Array.isArray(json) ? (json[0] ?? null) : json;
        return { data: singleItem as unknown as T, error: null, count };
      }
      if (this.isMaybeSingle) {
        const item = Array.isArray(json) ? (json[0] ?? null) : json;
        return { data: item as unknown as T, error: null, count };
      }
      return { data: json as unknown as T, error: null, count: count ?? (Array.isArray(json) ? json.length : null) };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Network request failed' }, count: null };
    }
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class MutationBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private tableName: string;
  private action: 'insert' | 'update' | 'delete';
  private payload?: any;
  private filters: Array<{ col: string; op?: string; val: any }> = [];
  private returnSingle: boolean = false;

  constructor(tableName: string, action: 'insert' | 'update' | 'delete', payload?: any) {
    this.tableName = tableName;
    this.action = action;
    this.payload = payload;
  }

  eq(column: string, value: any): this {
    this.filters.push({ col: column, op: 'eq', val: value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ col: column, op: 'in', val: values });
    return this;
  }

  select(_cols: string = '*'): this {
    return this;
  }

  single(): MutationBuilder<any> {
    this.returnSingle = true;
    return this;
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      const url = new URL(`${API_BASE_URL}/rest/v1/${this.tableName}`);
      for (const f of this.filters) {
        if (f.op === 'in') {
          const list = Array.isArray(f.val) ? f.val.join(',') : f.val;
          url.searchParams.set(f.col, `in.(${list})`);
        } else {
          url.searchParams.set(f.col, `eq.${f.val}`);
        }
      }

      const method = this.action === 'insert' ? 'POST' : this.action === 'update' ? 'PATCH' : 'DELETE';
      const res = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: this.payload ? JSON.stringify(this.payload) : undefined,
      });

      if (!res.ok) {
        const text = await res.text();
        return { data: null, error: { message: text || res.statusText } };
      }

      const json = await res.json();
      const resultData = this.returnSingle && Array.isArray(json) ? json[0] : json;
      return { data: resultData as unknown as T, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Database mutation failed' } };
    }
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class StorageClient {
  from(bucket: string) {
    return {
      upload: async (filePath: string, _file: File, _opts?: any) => {
        return { data: { path: filePath }, error: null };
      },
      getPublicUrl: (filePath: string) => {
        return { data: { publicUrl: `${API_BASE_URL}/storage/${bucket}/${filePath}` } };
      },
    };
  }
}

const authSubscribers: Array<(event: string, session: Session | null) => void> = [];

class AuthClient {
  async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
    const raw = localStorage.getItem('demo_session');
    if (raw) {
      try {
        return { data: { session: JSON.parse(raw) }, error: null };
      } catch (e) {}
    }
    return { data: { session: null }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    authSubscribers.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const index = authSubscribers.indexOf(callback);
            if (index > -1) authSubscribers.splice(index, 1);
          },
        },
      },
    };
  }

  async signInWithPassword(credentials: { email: string; password?: string }): Promise<{
    data: { session: Session | null; user: SessionUser | null };
    error: { message: string } | null;
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const text = await res.text();
        return { data: { session: null, user: null }, error: { message: text || 'Invalid login credentials' } };
      }
      const session = (await res.json()) as Session;
      authSubscribers.forEach((cb) => cb('SIGNED_IN', session));
      return { data: { session, user: session.user }, error: null };
    } catch (err: any) {
      return { data: { session: null, user: null }, error: { message: err?.message || 'Network error' } };
    }
  }

  async signUp(options: { email: string; password?: string; options?: { data?: Record<string, any> } }): Promise<{
    data: { session: Session | null; user: SessionUser | null };
    error: { message: string } | null;
  }> {
    return this.signInWithPassword({ email: options.email, password: options.password });
  }

  async signOut(): Promise<{ error: null }> {
    authSubscribers.forEach((cb) => cb('SIGNED_OUT', null));
    return { error: null };
  }
}

class ApiClient {
  auth = new AuthClient();
  storage = new StorageClient();

  from<T = any>(table: string) {
    return {
      select: (cols: string = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) =>
        new QueryBuilder<T>(table).select(cols, opts),
      insert: (payload: any) => new MutationBuilder<T>(table, 'insert', payload),
      update: (payload: any) => new MutationBuilder<T>(table, 'update', payload),
      delete: () => new MutationBuilder<T>(table, 'delete'),
    };
  }
}

export const isDatabaseConnected = true;
export const dbClient = new ApiClient();
