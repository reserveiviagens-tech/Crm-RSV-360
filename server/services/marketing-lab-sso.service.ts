import { logger } from "../lib/logger.js";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:3002";
const DEFAULT_MARKETING_LAB_URL = "http://127.0.0.1:3000";

export function getRsv360BackendUrl(): string {
  return (
    process.env.RSV360_BACKEND_URL ||
    process.env.BACKEND_API_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, "");
}

/** URL pública do site-publico / Marketing Lab (wizard /cotacao, /proposta, /roteiro). */
export function getMarketingLabUrl(): string {
  return (
    process.env.MARKETING_LAB_URL ||
    process.env.VITE_MARKETING_LAB_URL ||
    DEFAULT_MARKETING_LAB_URL
  ).replace(/\/$/, "");
}

/** Rotas B2C do S1 que vivem no S2 (site-publico), não no SPA Vite. */
export function isMarketingLabPublicPath(pathname: string): boolean {
  return (
    pathname === "/cotacao" ||
    pathname.startsWith("/cotacao/") ||
    pathname === "/proposta" ||
    pathname.startsWith("/proposta/") ||
    pathname === "/roteiro" ||
    pathname.startsWith("/roteiro/") ||
    pathname === "/h" ||
    pathname.startsWith("/h/")
  );
}

export function getSsoBffSecret(): string {
  return (process.env.SSO_BFF_SECRET || process.env.OAUTH_BFF_SECRET || "").trim();
}

/** Caminho interno no Marketing Lab (:3000), ex.: /lab ou /crm */
export function normalizeLabReturnPath(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/lab";
}

type IssueSuccess = {
  success: true;
  data: {
    callback_url: string;
    return_url?: string;
  };
};

type IssueFailure = {
  success?: false;
  error?: string;
};

export async function issueMarketingLabHandoff(params: {
  email: string;
  name: string;
  externalUserId: string;
  returnPath: string;
}): Promise<
  | { ok: true; callbackUrl: string }
  | { ok: false; status: number; message: string }
> {
  const secret = getSsoBffSecret();
  if (!secret && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      status: 503,
      message: "SSO do Marketing Lab não configurado (SSO_BFF_SECRET).",
    };
  }

  const backend = getRsv360BackendUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Sso-Bff-Secret"] = secret;
  }

  let response: Response;
  try {
    response = await fetch(`${backend}/api/v1/auth/sso/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: params.email,
        name: params.name,
        external_user_id: params.externalUserId,
        return_url: params.returnPath,
      }),
    });
  } catch (error) {
    logger.error("[sso] Falha ao contactar backend RSV360", { error });
    return {
      ok: false,
      status: 502,
      message: "Não foi possível contactar o servidor de autenticação do Marketing Lab.",
    };
  }

  let body: IssueSuccess | IssueFailure = {};
  try {
    body = (await response.json()) as IssueSuccess | IssueFailure;
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Resposta inválida do servidor de autenticação.",
    };
  }

  if (!response.ok || !("success" in body) || !body.success) {
    const failure = body as IssueFailure;
    logger.warn("[sso] issue rejeitado", { status: response.status, body });
    return {
      ok: false,
      status: response.status >= 400 ? response.status : 502,
      message:
        typeof failure.error === "string"
          ? failure.error
          : "Não foi possível iniciar login no Marketing Lab.",
    };
  }

  const callbackUrl = body.data?.callback_url;
  if (!callbackUrl || typeof callbackUrl !== "string") {
    return {
      ok: false,
      status: 502,
      message: "Resposta SSO incompleta (callback_url ausente).",
    };
  }

  return { ok: true, callbackUrl };
}
