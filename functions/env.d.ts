interface PagesEnv {
  VITE_API_BASE_URL?: string;
}

type PagesFunction<
  Env = PagesEnv,
  Params extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;

interface EventContext<Env, Params extends string, Data> {
  request: Request;
  env: Env;
  params: Record<Params, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  data: Data;
}