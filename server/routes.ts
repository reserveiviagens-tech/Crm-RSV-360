
import express from "express";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { scrypt, randomBytes, timingSafeEqual, createHmac, randomUUID } from "crypto";
import { promisify } from "util";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { raiseAlert, getActiveAlerts, getAlertCount, acknowledgeAlert } from "./lib/alerts.js";
import { getQueueStats } from "./services/retry-queue.service.js";
import { storage } from "./storage";
import { registerSchema, loginSchema, insertAtividadeWizardSchema } from "@shared/schema";
import { getOpcionais } from "./opcionais";
import {
  criarReserva,
  getReservasPorExcursao,
  chamarProximoDaFila,
} from "./reservas";
import { emitEstadoGrupo, emitPixExpirado, emitVigilancia } from "./socket";
import { createExcursionGroup, sendTextToGroup, sendPollToGroup, sendPaymentConfirmation, getWaasStatus, createInstance, getInstanceStatus, getQRCode, deleteInstance, fetchAllGroups, handleWebhookEvent } from "./services/whatsapp.service";
import { createSplitPaymentPix, checkPaymentStatus } from "./services/payment.service";
import { createTicketPix, checkTicketPaymentStatus, cancelTicketPix, demoAutoConfirmCallbacks, UnknownTicketError } from "./services/ticket-payment.service";
import {
  acquireHold,
  attachHoldToTransaction,
  consumeHoldByTransaction,
  getAvailabilitySnapshot,
  getHold,
  refreshHold,
  releaseHold,
  releaseHoldByTransaction,
  InsufficientInventoryError,
  HoldNotFoundError,
  HoldConflictError,
  TICKET_HOLD_TTL_MS,
} from "./services/ticket-hold.service";
import { pauseAI, resumeAI, isAIPaused, getHandoffInfo, listPausedGroups } from "./services/humanHandoff.service";
import {
  gerarManifestoANTT,
  gerarFNRH,
  gerarVoucherVIP,
  type PassageiroBurocracia,
} from "./services/bureaucracyService";
import { gerarRelatorioContabil } from "./services/accountingService";
import {
  createExcursao,
  deleteExcursao,
  findExcursao,
  listExcursoes,
  updateExcursao,
  type Excursao,
  type ExcursaoStatus,
  type Passageiro,
  type RoteiroCatalogCard,
  type RoteiroCatalogCategory,
} from "./excursoes";
import { mutateDb } from "./persistence";
import {
  createInvite,
  ensureGroupForExcursao,
  getGroupById,
  listMemberships,
  listOrders,
  recalculateVoucherForGroup,
  upsertMembership,
  upsertOrder,
  validateInvite,
  consumeInvite,
} from "./social-commerce";
import { registerWeatherRoutes } from "./routes/weather-routes.js";
import { registerAuctionsRoutes } from "./routes/auctions-routes.js";
import { registerFlashDealsRoutes } from "./routes/flash-deals-routes.js";
import adminOffersRoutes from "./routes/admin-offers.routes.js";
import adminWebsiteRoutes from "./routes/admin-website.routes.js";
import { searchItems, suggestItems, filterCatalogExcursoes } from "./search-data";
import {
  adicionarPontos,
  getPontos,
  getHistorico,
  getConquistas,
  CONQUISTAS_DEFS as CONQUISTAS_DEFS_SERVICE,
} from "./services/gamification-service";
import {
  issueMarketingLabHandoff,
  normalizeLabReturnPath,
} from "./services/marketing-lab-sso.service.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  registerWeatherRoutes(app);
  registerAuctionsRoutes(app);
  registerFlashDealsRoutes(app);

  // ─── STATIC — Media uploads ───────────────────────────────────────────────
  const uploadsDir = path.resolve(process.cwd(), "uploads", "website");
  app.use("/uploads/website", express.static(uploadsDir));

  // ─── ADMIN WEBSITE CMS ───────────────────────────────────────────────────
  app.use("/api/admin/website", async (req, res, next) => {
    const userId = (req.session as { userId?: string })?.userId;
    if (!userId) return res.status(401).json({ success: false, error: "Não autenticado", code: "UNAUTHORIZED" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ success: false, error: "Acesso restrito a administradores", code: "FORBIDDEN" });
    next();
  }, adminWebsiteRoutes);

  // ─── ADMIN OFFERS CMS (leilões / flash deals / regras) ───────────────────
  app.use("/api/admin/offers", async (req, res, next) => {
    const userId = (req.session as { userId?: string })?.userId;
    if (!userId) return res.status(401).json({ success: false, error: "Não autenticado", code: "UNAUTHORIZED" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ success: false, error: "Acesso restrito a administradores", code: "FORBIDDEN" });
    next();
  }, adminOffersRoutes);

  // ─── RATE LIMITERS (Fase 08 — hardening) ─────────────────────────────────
  // voucher: 10 req/min por IP — protege geração de PDF e HMAC token
  const voucherRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Muitas requisições de voucher. Aguarde 1 minuto e tente novamente." },
  });

  // pix webhook: 30 req/min por IP — throttle de callbacks do gateway
  const pixWebhookRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Limite de requisições de webhook atingido." },
  });

  // recomendações: 60 req/min por IP — throttle de chamadas à engine de IA
  const recommendationsRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Limite de requisições de recomendações atingido." },
  });

  // ─── VOUCHER HMAC SECRET ──────────────────────────────────────────────────
  const VOUCHER_SECRET_ENV = process.env.VOUCHER_SECRET;
  const VOUCHER_SECRET_DEV_FALLBACK = "rsv360-voucher-dev-secret";

  if (!VOUCHER_SECRET_ENV) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[security] VOUCHER_SECRET env var não configurada em produção! " +
        "Tokens de voucher estarão usando um segredo inseguro. Configure VOUCHER_SECRET imediatamente."
      );
    } else {
      console.warn("[security] VOUCHER_SECRET não configurada — usando fallback de desenvolvimento (inseguro em produção).");
    }
  }

  const VOUCHER_SECRET = VOUCHER_SECRET_ENV || VOUCHER_SECRET_DEV_FALLBACK;

  function signVoucherId(voucherId: string): string {
    return createHmac("sha256", VOUCHER_SECRET).update(voucherId).digest("hex");
  }

  function verifyVoucherToken(voucherId: string, token: string): boolean {
    const expected = signVoucherId(voucherId);
    try {
      return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
    } catch {
      return false;
    }
  }

  // ─── HEALTHCHECK ──────────────────────────────────────────────────────────
  app.get("/api/status", (_req: Request, res: Response) => {
    const queueStats = getQueueStats();
    const alertCount = getAlertCount();
    res.json({
      ok: true,
      service: "RSV360 — Reservei Viagens",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      queues: {
        deliveryQueue: queueStats.deliveryQueue,
        confirmationQueue: queueStats.confirmationQueue,
      },
      alerts: {
        active: alertCount.active,
        total: alertCount.total,
      },
    });
  });

  const getActorFromHeaders = (req: Request) => {
    const userId = String(req.get("x-user-id") ?? "").trim();
    const nome = String(req.get("x-user-name") ?? "").trim() || "Usuário";
    return { userId, nome };
  };

  const scryptAsync = promisify(scrypt);

  const hashPassword = async (password: string): Promise<string> => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  };

  const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
    const [hash, salt] = stored.split(".");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedBuf = Buffer.from(hash, "hex");
    return timingSafeEqual(buf, storedBuf);
  };

  const safeUser = (u: any) => ({
    id: u.id, nome: u.nome, email: u.email,
    telefone: u.telefone, role: u.role,
    cpf: u.cpf, fotoUrl: u.fotoUrl, provider: u.provider,
  });

  // ─── SEED DEMO ────────────────────────────────────────────────────────────
  let DEMO_EXCURSAO_ID = "";
  let DEMO_INVITE_CODE = "INV-DEMO-000000";

  (async () => {
    // 1. Usuário demo
    const DEMO_EMAIL = "demo@reservei.com.br";
    let demoUser = await storage.getUserByEmail(DEMO_EMAIL);
    if (!demoUser) {
      const hashedPassword = await hashPassword("demo123");
      demoUser = await storage.createUser({
        username: DEMO_EMAIL,
        password: hashedPassword,
        nome: "Demo Master",
        email: DEMO_EMAIL,
        telefone: "(62) 99999-0000",
        cpf: "00000000000",
        role: "admin",
        googleId: "",
        fotoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=DM&backgroundColor=1e3a5f&textColor=ffffff",
        provider: "local",
      });
      console.log("[SEED] Usuário demo criado → demo@reservei.com.br / demo123 (admin)");
    }

    // 2. Excursão demo
    const allExcursoes = await listExcursoes();
    let demoExcursao = allExcursoes.find((e) => e.nome === "Caldas Novas — Grupo Demo");
    if (!demoExcursao) {
      demoExcursao = await createExcursao({
        nome: "Caldas Novas — Grupo Demo",
        destino: "Caldas Novas, GO",
        dataIda: "2026-07-15",
        dataVolta: "2026-07-20",
        localSaida: "Goiânia - Terminal Rodoviário",
        capacidade: 40,
        veiculoTipo: "Ônibus",
        status: "aberta",
      });
      console.log(`[SEED] Excursão demo criada → id=${demoExcursao.id}`);
    }
    DEMO_EXCURSAO_ID = demoExcursao.id;

    const existingRoteiro = demoExcursao.wizard?.roteiroOficial;
    const hasCards = existingRoteiro?.hoteis && existingRoteiro.hoteis.length > 0;
    if (!hasCards) {
      const roteiroOficial = {
        veiculoTipo: "Ônibus" as const,
        veiculoAutomatico: true,
        manualVehicleOverride: false,
        hotelPrincipal: "Di Roma Grand Hotel",
        atracoes: ["Mirante do Rio Corumbá", "Feira Noturna de Caldas Novas", "Museu das Culturas"],
        passeios: ["Passeio de Barco — Lago Corumbá", "Quadriciclo nas Trilhas do Cerrado", "Pesca Esportiva Rio Quente"],
        parquesAquaticos: ["Hot Park", "Di Roma Acqua Park", "Lagoa Quente Thermas"],
        hoteis: [
          { id: "hotel-di-roma", titulo: "Di Roma Grand Hotel", descricaoBreve: "Resort 5 estrelas com piscinas termais, toboáguas e spa completo", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 280, duracaoHoras: 24, horarioSaida: "14:00", diasDisponiveis: ["D1", "D2", "D3", "D4", "D5"], badgeTipo: "popular" as const },
          { id: "hotel-laranjais", titulo: "Resort Thermas dos Laranjais", descricaoBreve: "Resort familiar com águas termais naturais e área de lazer completa", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 220, duracaoHoras: 24, horarioSaida: "14:00", diasDisponiveis: ["D1", "D2", "D3", "D4", "D5"], badgeTipo: "ia" as const },
        ],
        atracoesCards: [
          { id: "atracao-mirante", titulo: "Mirante do Rio Corumbá", descricaoBreve: "Vista panorâmica do lago e pôr do sol inesquecível", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 0, duracaoHoras: 2, horarioSaida: "16:30", diasDisponiveis: ["D2", "D3", "D4"] },
          { id: "atracao-feira", titulo: "Feira Noturna de Caldas Novas", descricaoBreve: "Artesanato, gastronomia regional e apresentações culturais", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 0, duracaoHoras: 3, horarioSaida: "19:00", diasDisponiveis: ["D1", "D3", "D5"] },
          { id: "atracao-museu", titulo: "Museu das Culturas", descricaoBreve: "Exposição interativa sobre a história e cultura do cerrado goiano", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 15, duracaoHoras: 2, horarioSaida: "10:00", diasDisponiveis: ["D2", "D4"] },
        ],
        passeiosCards: [
          { id: "passeio-barco", titulo: "Passeio de Barco — Lago Corumbá", descricaoBreve: "Navegação pelo lago com paradas para banho e fotos", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 85, duracaoHoras: 3, horarioSaida: "09:00", diasDisponiveis: ["D2", "D3", "D4"], badgeTipo: "popular" as const },
          { id: "passeio-quadri", titulo: "Quadriciclo nas Trilhas do Cerrado", descricaoBreve: "Aventura off-road pelas trilhas com guia especializado", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 120, duracaoHoras: 2, horarioSaida: "08:00", diasDisponiveis: ["D3", "D5"] },
          { id: "passeio-pesca", titulo: "Pesca Esportiva Rio Quente", descricaoBreve: "Pesca esportiva com todo equipamento incluso e instrutor", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 95, duracaoHoras: 4, horarioSaida: "06:00", diasDisponiveis: ["D2", "D4"] },
        ],
        parquesAquaticosCards: [
          { id: "parque-hotpark", titulo: "Hot Park", descricaoBreve: "Maior parque de águas quentes do mundo — toboáguas, rio lento e praia artificial", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 189, duracaoHoras: 8, horarioSaida: "09:00", diasDisponiveis: ["D1", "D2", "D3", "D4"], badgeTipo: "ia" as const },
          { id: "parque-diroma", titulo: "Di Roma Acqua Park", descricaoBreve: "Piscinas termais, toboáguas radicais e área infantil completa", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 130, duracaoHoras: 6, horarioSaida: "10:00", diasDisponiveis: ["D2", "D3", "D5"], badgeTipo: "popular" as const },
          { id: "parque-lagoa", titulo: "Lagoa Quente Thermas", descricaoBreve: "Complexo termal com águas naturalmente aquecidas e spa relaxante", galeriaImagens: [] as string[], galeriaVideos: [] as string[], precoPorPessoa: 75, duracaoHoras: 5, horarioSaida: "10:00", diasDisponiveis: ["D1", "D3", "D4"] },
        ],
      };
      await updateExcursao(demoExcursao.id, {
        wizard: { ...(demoExcursao.wizard ?? {}), roteiroOficial: roteiroOficial },
      });
      console.log("[SEED] Roteiro oficial com 11 cards de Caldas Novas");
    }

    // 3. Grupo e convite
    const group = await ensureGroupForExcursao(demoExcursao.id, demoExcursao.nome, demoExcursao.capacidade);
    await upsertMembership(group.id, demoUser.id, demoUser.nome, "ADMIN");

    const { mutateDb } = await import("./persistence");
    const existingCode = await mutateDb((db: any) => {
      const invites = (db.inviteStore as Array<{ groupId: string; code: string; used: boolean }>) ?? [];
      return invites.find((i) => i.groupId === group.id && !i.used)?.code ?? null;
    });
    if (existingCode) {
      DEMO_INVITE_CODE = existingCode;
    } else {
      const inv = await createInvite(group.id, { multiUse: true });
      DEMO_INVITE_CODE = inv.code;
    }
    console.log(`[SEED] Convite demo → ${DEMO_INVITE_CODE} (excursão ${DEMO_EXCURSAO_ID})`);
  })();

  // ─── AUTH ────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

    const { nome, email, telefone, cpf = "", senha } = parsed.data;

    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ message: "E-mail já cadastrado" });

    if (cpf) {
      const existingCpf = await storage.getUserByCpf(cpf);
      if (existingCpf) return res.status(409).json({ message: "CPF já cadastrado" });
    }

    const hashedPassword = await hashPassword(senha);
    const user = await storage.createUser({
      username: email,
      password: hashedPassword,
      nome, email, telefone, cpf,
      role: "user", googleId: "", fotoUrl: "", provider: "local",
    });

    req.session.userId = user.id;
    return res.status(201).json(safeUser(user));
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

    const { identificador, senha } = parsed.data;

    const user = await storage.getUserByIdentifier(identificador);
    if (!user) return res.status(401).json({ message: "Credenciais não encontradas" });

    if (user.provider !== "local" || !user.password) {
      return res.status(401).json({ message: `Esta conta usa login via ${user.provider}. Use o botão correspondente.` });
    }

    const ok = await verifyPassword(senha, user.password);
    if (!ok) return res.status(401).json({ message: "Senha incorreta" });

    req.session.userId = user.id;
    return res.json(safeUser(user));
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
    return res.json(safeUser(user));
  });

  /** SSO → Marketing Lab (rsv360 :3000). Requer sessão S1 + backend :3002. */
  app.get("/api/auth/lab-handoff", async (req: Request, res: Response) => {
    const returnPath = normalizeLabReturnPath(req.query.return);

    if (!req.session.userId) {
      const loginUrl = `/entrar?lab_return=${encodeURIComponent(returnPath)}`;
      return res.redirect(loginUrl);
    }

    const user = await storage.getUser(req.session.userId);
    if (!user?.email) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const result = await issueMarketingLabHandoff({
      email: user.email,
      name: user.nome || user.email,
      externalUserId: String(user.id),
      returnPath,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.redirect(result.callbackUrl);
  });

  app.post("/api/auth/selfie", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const { fotoUrl } = req.body;
    if (!fotoUrl || typeof fotoUrl !== "string") {
      return res.status(400).json({ message: "Foto inválida" });
    }
    const updated = await storage.updateUser(req.session.userId, { fotoUrl });
    if (!updated) return res.status(404).json({ message: "Usuário não encontrado" });
    return res.json(safeUser(updated));
  });

  app.post("/api/auth/tornar-lider", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    if (user.role === "LIDER" || user.role === "admin") {
      return res.json({ ...safeUser(user), message: "Você já é um Líder!" });
    }
    const { tipoGrupo, qtdPessoas } = req.body as { tipoGrupo?: string; qtdPessoas?: number };
    console.log(`[LIDER-CANDIDATURA] user=${user.id} nome="${user.nome}" tipoGrupo=${tipoGrupo} qtdPessoas=${qtdPessoas}`);
    const updated = await storage.updateUser(req.session.userId, { role: "LIDER" });
    if (!updated) return res.status(500).json({ message: "Erro ao atualizar role" });
    return res.json(safeUser(updated));
  });

  // ─── PERFIL EDIT ────────────────────────────────────────────────────────────

  app.patch("/api/auth/perfil", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const { nome, telefone } = req.body as { nome?: string; telefone?: string };
    const updates: Record<string, string> = {};
    if (typeof nome === "string" && nome.trim().length >= 3) updates.nome = nome.trim();
    if (typeof telefone === "string" && telefone.trim().length >= 10) updates.telefone = telefone.trim();
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "Nenhum campo válido para atualizar" });
    const updated = await storage.updateUser(req.session.userId, updates);
    if (!updated) return res.status(404).json({ message: "Usuário não encontrado" });
    return res.json(safeUser(updated));
  });

  // ─── RESERVAS DO PASSAGEIRO ─────────────────────────────────────────────────

  type ReservaPassageiro = {
    id: string;
    hotel: string;
    dates: string;
    status: "Confirmada" | "Pendente" | "Cancelada";
    location: string;
    excursaoId?: string;
  };

  const reservaPassageiroStore: Record<string, ReservaPassageiro[]> = {};

  const seedReservasForUser = (userId: string, nome: string) => {
    if (reservaPassageiroStore[userId]) return;
    reservaPassageiroStore[userId] = [
      { id: `res-${userId}-1`, hotel: "Resort Termas Paradise", dates: "13/05/2026", status: "Confirmada", location: "Caldas Novas" },
      { id: `res-${userId}-2`, hotel: "Hot Park - Ingresso Família", dates: "15/05/2026", status: "Pendente", location: "Rio Quente" },
    ];
  };

  app.get("/api/reservas/minhas", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
    seedReservasForUser(user.id, user.nome);
    return res.json({ items: reservaPassageiroStore[user.id] ?? [] });
  });

  // ─── NOTIFICAÇÕES ──────────────────────────────────────────────────────────

  type Notificacao = {
    id: string;
    titulo: string;
    mensagem: string;
    tipo: "info" | "sucesso" | "alerta" | "promo";
    lida: boolean;
    criadoEm: string;
  };

  const notificacaoStore: Record<string, Notificacao[]> = {};

  const seedNotificacoesForUser = (userId: string) => {
    if (notificacaoStore[userId]) return;
    const now = new Date();
    notificacaoStore[userId] = [
      {
        id: `notif-${userId}-1`, titulo: "Reserva confirmada!",
        mensagem: "Sua reserva no Resort Termas Paradise foi confirmada para 13/05/2026.",
        tipo: "sucesso", lida: false, criadoEm: new Date(now.getTime() - 2 * 3600000).toISOString(),
      },
      {
        id: `notif-${userId}-2`, titulo: "Pagamento pendente",
        mensagem: "O pagamento do Hot Park - Ingresso Família está aguardando confirmação PIX.",
        tipo: "alerta", lida: false, criadoEm: new Date(now.getTime() - 24 * 3600000).toISOString(),
      },
      {
        id: `notif-${userId}-3`, titulo: "Promoção imperdível!",
        mensagem: "Di Roma Acqua Park com 30% de desconto para grupos acima de 10 pessoas.",
        tipo: "promo", lida: false, criadoEm: new Date(now.getTime() - 48 * 3600000).toISOString(),
      },
    ];
  };

  app.get("/api/notificacoes", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    seedNotificacoesForUser(req.session.userId);
    const items = notificacaoStore[req.session.userId] ?? [];
    const naoLidas = items.filter((n) => !n.lida).length;
    return res.json({ items, naoLidas });
  });

  app.patch("/api/notificacoes/:id/lida", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    seedNotificacoesForUser(req.session.userId);
    const items = notificacaoStore[req.session.userId] ?? [];
    const notif = items.find((n) => n.id === req.params.id);
    if (!notif) return res.status(404).json({ message: "Notificação não encontrada" });
    notif.lida = true;
    return res.json(notif);
  });

  // ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const googleConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

  app.get("/api/demo/info", (_req: Request, res: Response) => {
    res.json({ excursaoId: DEMO_EXCURSAO_ID, inviteCode: DEMO_INVITE_CODE });
  });

  app.get("/api/auth/google/status", (_req: Request, res: Response) => {
    res.json({ configured: googleConfigured });
  });

  if (googleConfigured) {
    const { default: passport } = await import("passport");
    const { Strategy: GoogleStrategy } = await import("passport-google-oauth20");

    const CALLBACK_URL = process.env.NODE_ENV === "production"
      ? `${process.env.BASE_URL ?? ""}/api/auth/google/callback`
      : `http://localhost:5000/api/auth/google/callback`;

    passport.use(new GoogleStrategy(
      { clientID: GOOGLE_CLIENT_ID!, clientSecret: GOOGLE_CLIENT_SECRET!, callbackURL: CALLBACK_URL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await storage.getUserByGoogleId(profile.id);
          if (!user) {
            const email = profile.emails?.[0]?.value ?? `${profile.id}@google.com`;
            user = await storage.getUserByEmail(email);
            if (user) {
              user = await storage.updateUser(user.id, { googleId: profile.id, provider: "google", fotoUrl: profile.photos?.[0]?.value ?? "" }) ?? user;
            } else {
              user = await storage.createUser({
                username: email, password: "", nome: profile.displayName ?? "Usuário Google",
                email, telefone: "", cpf: "", role: "user",
                googleId: profile.id, fotoUrl: profile.photos?.[0]?.value ?? "", provider: "google",
              });
            }
          }
          done(null, user);
        } catch (e) {
          done(e as Error);
        }
      }
    ));

    passport.serializeUser((user: any, done) => done(null, user.id));
    passport.deserializeUser(async (id: string, done) => {
      try { done(null, await storage.getUser(id)); } catch (e) { done(e); }
    });

    app.use(passport.initialize());
    app.use(passport.session());

    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/entrar?erro=google" }),
      (req: Request, res: Response) => {
        const user = req.user as any;
        if (user) req.session.userId = user.id;
        res.redirect("/perfil");
      }
    );
  } else {
    app.get("/api/auth/google", (_req: Request, res: Response) => {
      res.redirect("/entrar?erro=google-nao-configurado");
    });
  }

  const getMembershipRole = async (excursao: Excursao, userId: string) => {
    if (!userId) return null;
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const memberships = await listMemberships(group.id);
    const role = memberships.find((m) => m.userId === userId)?.status ?? null;
    return { group, role };
  };

  const isAdminForExcursao = async (excursao: Excursao, userId: string) => {
    const info = await getMembershipRole(excursao, userId);
    return info?.role === "ADMIN";
  };

  type RoteiroCard = {
    id: string;
    titulo: string;
    descricaoBreve?: string;
    galeriaImagens: string[];
    galeriaVideos: string[];
    /** Preço por pessoa em BRL ou centavos (interpretado pelo cliente). */
    precoPorPessoa?: number;
    /** Duração da atividade em horas inteiras. */
    duracaoHoras?: number;
    /** Horário de saída aproximado, ex.: "09:00". */
    horarioSaida?: string;
    /** Dias da viagem em que a atividade está disponível, ex.: ["D1","D2"]. */
    diasDisponiveis?: string[];
    /** Badge visual sugerida para o card (Recomendado IA / Mais Popular). */
    badgeTipo?: "ia" | "popular";
    createdAt?: string;
    updatedAt?: string;
  };

  type RoteiroPayload = Partial<NonNullable<Excursao["wizard"]>["roteiroOficial"]> & { publish?: boolean };

  const toVehicleByCapacity = (capacidade: number): "Van" | "Micro" | "Ônibus" => {
    if (capacidade <= 15) return "Van";
    if (capacidade <= 28) return "Micro";
    return "Ônibus";
  };

  const sanitizeMediaList = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0)
      .slice(0, 12);
  };

  const normalizeCard = (value: unknown, fallbackPrefix: string): RoteiroCard | null => {
    if (!value || typeof value !== "object") return null;
    const src = value as Record<string, unknown>;
    const titulo = String(src.titulo ?? src.valor ?? "").trim();
    if (!titulo) return null;
    const id = String(src.id ?? `${fallbackPrefix}-${Math.random().toString(36).slice(2, 9)}`);
    const descricaoBreve = String(src.descricaoBreve ?? src.descricao ?? "").trim() || undefined;
    const precoPorPessoaRaw = src.precoPorPessoa;
    const duracaoHorasRaw = src.duracaoHoras;
    const horarioSaidaRaw = src.horarioSaida;
    const diasDisponiveisRaw = src.diasDisponiveis;
    const precoPorPessoa =
      typeof precoPorPessoaRaw === "number" && Number.isFinite(precoPorPessoaRaw)
        ? precoPorPessoaRaw
        : undefined;
    const duracaoHoras =
      typeof duracaoHorasRaw === "number" && Number.isFinite(duracaoHorasRaw) && duracaoHorasRaw > 0
        ? duracaoHorasRaw
        : undefined;
    const horarioSaida =
      typeof horarioSaidaRaw === "string" && horarioSaidaRaw.trim().length > 0
        ? horarioSaidaRaw.trim()
        : undefined;
    const diasDisponiveis = Array.isArray(diasDisponiveisRaw)
      ? diasDisponiveisRaw
          .map((v) => String(v ?? "").trim())
          .filter((v) => v.length > 0)
          .slice(0, 10)
      : undefined;
    const badgeTipo =
      src.badgeTipo === "ia" || src.badgeTipo === "popular" ? (src.badgeTipo as "ia" | "popular") : undefined;
    return {
      id,
      titulo,
      descricaoBreve,
      galeriaImagens: sanitizeMediaList(src.galeriaImagens),
      galeriaVideos: sanitizeMediaList(src.galeriaVideos),
      precoPorPessoa,
      duracaoHoras,
      horarioSaida,
      diasDisponiveis,
      badgeTipo,
      createdAt: typeof src.createdAt === "string" ? src.createdAt : undefined,
      updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : undefined,
    };
  };

  const normalizeCardsArray = (value: unknown, fallbackPrefix: string) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, idx) => normalizeCard(item, `${fallbackPrefix}-${idx}`))
      .filter((item): item is RoteiroCard => Boolean(item));
  };

  const toCardsFromLegacyArray = (arr: string[], prefix: string) =>
    (arr || []).map((item, idx) => ({
      id: `${prefix}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: item,
      descricaoBreve: undefined,
      galeriaImagens: [],
      galeriaVideos: [],
    }));

  const normalizeCatalogCategory = (raw: string): RoteiroCatalogCategory | null => {
    if (
      raw === "atracoes" ||
      raw === "passeios" ||
      raw === "parquesAquaticos" ||
      raw === "refeicoes" ||
      raw === "transfers"
    ) {
      return raw;
    }
    return null;
  };

  const getCatalogo = (excursao: Excursao) => {
    const wizard = excursao.wizard ?? {};
    const catalogo = wizard.catalogoRoteiro ?? {
      atracoes: [],
      passeios: [],
      parquesAquaticos: [],
      refeicoes: [],
      transfers: [],
      updatedAt: undefined,
    };
    return {
      atracoes: normalizeCardsArray(catalogo.atracoes, "catalogo-atracao"),
      passeios: normalizeCardsArray(catalogo.passeios, "catalogo-passeio"),
      parquesAquaticos: normalizeCardsArray(catalogo.parquesAquaticos, "catalogo-parque"),
      refeicoes: normalizeCardsArray(catalogo.refeicoes, "catalogo-refeicao"),
      transfers: normalizeCardsArray(catalogo.transfers, "catalogo-transfer"),
      updatedAt: catalogo.updatedAt,
    };
  };

  // API de excursões (versão inicial em memória)

  app.get("/api/opcionais", (_req: Request, res: Response) => {
    res.json({ items: getOpcionais() });
  });

  app.get("/api/excursoes", async (req: Request, res: Response) => {
    const items = await listExcursoes();
    const { destino, preco_min, preco_max, mes, q, cidade_saida, sort } = req.query as Record<string, string>;
    const hasFilter = destino || preco_min || preco_max || mes || q || cidade_saida;
    if (!hasFilter && !sort) {
      return res.json({ items });
    }
    let filtered = [...items];
    if (q) filtered = filtered.filter(i =>
      (i.nome || '').toLowerCase().includes(q.toLowerCase()) ||
      (i.destino || '').toLowerCase().includes(q.toLowerCase())
    );
    if (destino) filtered = filtered.filter(i =>
      (i.destino || '').toLowerCase().includes(destino.toLowerCase())
    );
    if (cidade_saida) {
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      filtered = filtered.filter(i => normalize(i.localSaida || '').includes(normalize(cidade_saida)));
    }
    if (preco_min) {
      const min = Number(preco_min);
      if (!isNaN(min)) filtered = filtered.filter(i => i.precoAdulto !== undefined && i.precoAdulto >= min);
    }
    if (preco_max) {
      const max = Number(preco_max);
      if (!isNaN(max)) filtered = filtered.filter(i => i.precoAdulto !== undefined && i.precoAdulto <= max);
    }
    if (mes) {
      const mesNum = Number(mes);
      if (!isNaN(mesNum)) filtered = filtered.filter(i => i.dataIda && new Date(i.dataIda).getMonth() + 1 === mesNum);
    }
    if (sort === 'data_asc' || !sort) filtered.sort((a, b) => a.dataIda.localeCompare(b.dataIda));
    else if (sort === 'data_desc') filtered.sort((a, b) => b.dataIda.localeCompare(a.dataIda));
    return res.json({ items: filtered });
  });

  app.get("/api/excursoes/catalogo", (req: Request, res: Response) => {
    const { destino, preco_min, preco_max, mes, cidade_saida, categoria, q, sort, page, limit } = req.query as Record<string, string>;
    const result = filterCatalogExcursoes({
      destino: destino || undefined,
      preco_min: preco_min ? Number(preco_min) : undefined,
      preco_max: preco_max ? Number(preco_max) : undefined,
      mes: mes || undefined,
      cidade_saida: cidade_saida || undefined,
      categoria: categoria || undefined,
      q: q || undefined,
      sort: sort || undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.json(result);
  });

  app.get("/api/search", (req: Request, res: Response) => {
    const { q, type, city, profile, minPrice, maxPrice, rating, sort, page, limit, comboAvailable, isFeatured, category, enterprise } = req.query as Record<string, string>;
    const minPriceNum = minPrice ? Number(minPrice) : undefined;
    const maxPriceNum = maxPrice ? Number(maxPrice) : undefined;
    const ratingNum = rating ? Number(rating) : undefined;
    const result = searchItems({
      q: q || undefined,
      type: type || undefined,
      city: city || undefined,
      profile: profile || undefined,
      minPrice: minPriceNum !== undefined && !isNaN(minPriceNum) ? minPriceNum : undefined,
      maxPrice: maxPriceNum !== undefined && !isNaN(maxPriceNum) ? maxPriceNum : undefined,
      rating: ratingNum !== undefined && !isNaN(ratingNum) ? ratingNum : undefined,
      sort: sort || undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      comboAvailable: comboAvailable === "true" ? true : undefined,
      isFeatured: isFeatured === "true" ? true : undefined,
      category: category || undefined,
      enterprise: enterprise || undefined,
    });
    res.json({
      ...result,
      page: page ? Number(page) : 1,
      appliedFilters: { q, type, city, profile, minPrice: minPrice ? Number(minPrice) : undefined, maxPrice: maxPrice ? Number(maxPrice) : undefined },
      queryInfo: { normalizedQuery: (q || "").toLowerCase().trim(), intent: {} },
      suggestions: [],
    });
  });

  app.get("/api/search/suggest", (req: Request, res: Response) => {
    const { q } = req.query as Record<string, string>;
    res.json(suggestItems(q || ""));
  });

  app.get("/api/search/suggestions", (req: Request, res: Response) => {
    const { q } = req.query as Record<string, string>;
    const { names } = suggestItems(q || "");
    res.json(names);
  });

  app.get("/api/search/places", (_req: Request, res: Response) => {
    res.json({ suggestions: [] });
  });

  app.get("/api/excursoes/:id", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    return res.json(item);
  });

  app.post("/api/excursoes", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "Faça login para criar excursões.", code: "NOT_AUTHENTICATED" });
    }
    const requester = await storage.getUser(userId);
    if (!requester || (requester.role !== "LIDER" && requester.role !== "admin")) {
      return res.status(403).json({ message: "Apenas Líderes podem criar excursões.", code: "NOT_LIDER" });
    }

    const body = req.body as Partial<Excursao>;

    if (!body.nome || !body.dataIda || !body.dataVolta || !body.destino) {
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "Campos obrigatórios: nome, dataIda, dataVolta, destino",
        code: "EXCURSAO_INVALID_PAYLOAD",
      });
    }

    const novaPayload: Omit<Excursao, "id"> = {
      nome: body.nome,
      dataIda: body.dataIda,
      dataVolta: body.dataVolta,
      destino: body.destino,
      localSaida: body.localSaida || "A definir",
      capacidade: body.capacidade ?? 28,
      veiculoTipo: body.veiculoTipo || "Micro",
      status: (body.status as ExcursaoStatus) || "rascunho",
      wizard: body.wizard,
      anttNumero: body.anttNumero,
      anttValido: body.anttValido,
      cadasturNumero: body.cadasturNumero,
      cadasturValido: body.cadasturValido,
    };

    const nova = await createExcursao(novaPayload);
    const group = await ensureGroupForExcursao(nova.id, nova.nome, nova.capacidade);
    await createInvite(group.id);
    return res.status(201).json(nova);
  });

  app.get("/api/excursoes/:id/reservas", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    const reservas = await getReservasPorExcursao(String(req.params.id));
    return res.json({ items: reservas });
  });

  app.post("/api/excursoes/:id/reservas", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    const body = req.body as {
      passageiroId: string;
      passageiroNome: string;
      assento?: string;
      aceitouTermos?: boolean;
      termoVersao?: string;
    };
    if (!body.passageiroId || !body.passageiroNome) {
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "passageiroId e passageiroNome são obrigatórios",
        code: "RESERVA_INVALID_PAYLOAD",
      });
    }
    if (body.aceitouTermos !== true) {
      return res.status(400).json({
        error: "TERMOS_NAO_ACEITOS",
        message: "É necessário aceitar os termos de responsabilidade.",
        code: "TERMOS_NAO_ACEITOS",
      });
    }
    const dataExpiracaoPix = new Date(Date.now() + 15 * 60 * 1000);
    const forwarded = req.headers["x-forwarded-for"];
    const ipAceite =
      (req as unknown as { ip?: string }).ip ??
      (typeof forwarded === "string" ? forwarded : Array.isArray(forwarded) ? forwarded[0] : undefined) ??
      req.socket?.remoteAddress;
    const logAceite = {
      ipAceite: ipAceite ?? undefined,
      userAgent: req.get("User-Agent") ?? undefined,
      timestampAceite: new Date(),
      termoVersao: body.termoVersao ?? "1.0",
    };
    const reserva = await criarReserva(String(req.params.id), body.passageiroId, body.passageiroNome, {
      assento: body.assento,
      dataExpiracaoPix,
      logAceite,
    });
    const group = await ensureGroupForExcursao(item.id, item.nome, item.capacidade);
    await upsertMembership(group.id, body.passageiroId, body.passageiroNome, "MEMBER");
    await upsertOrder(group.id, body.passageiroId, { totalAmount: 450, paidAmount: 0 });
    return res.status(201).json(reserva);
  });

  app.delete("/api/excursoes/:id", async (req: Request, res: Response) => {
    const deleted = await deleteExcursao(String(req.params.id));
    if (!deleted) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    return res.status(204).send();
  });

  app.patch("/api/excursoes/:id", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }

    const body = req.body as Partial<Excursao>;

    if (typeof body.nome === "string") item.nome = body.nome;
    if (typeof body.dataIda === "string") item.dataIda = body.dataIda;
    if (typeof body.dataVolta === "string") item.dataVolta = body.dataVolta;
    if (typeof body.destino === "string") item.destino = body.destino;
    if (typeof body.localSaida === "string") item.localSaida = body.localSaida;
    if (typeof body.capacidade === "number") item.capacidade = body.capacidade;
    if (typeof body.veiculoTipo === "string") item.veiculoTipo = body.veiculoTipo;
    if (typeof body.status === "string") item.status = body.status as ExcursaoStatus;

    if (body.wizard) {
      item.wizard = body.wizard;
    }
    if (typeof body.anttNumero !== "undefined") item.anttNumero = body.anttNumero;
    if (typeof body.anttValido !== "undefined") item.anttValido = body.anttValido;
    if (typeof body.cadasturNumero !== "undefined") item.cadasturNumero = body.cadasturNumero;
    if (typeof body.cadasturValido !== "undefined") item.cadasturValido = body.cadasturValido;

    const updated = await updateExcursao(String(req.params.id), item);
    return res.json(updated);
  });

  /** Verifica se a excursão pode ter reserva de veículo (certificações ANTT e Cadastur válidas). */
  app.get("/api/excursoes/:id/pode-reservar-veiculo", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    const anttOk = item.anttValido === true;
    const cadasturOk = item.cadasturValido === true;
    const ok = anttOk && cadasturOk;
    let motivo: string | undefined;
    if (!ok) {
      if (!anttOk && !cadasturOk) motivo = "Certificação ANTT e Cadastur inválidas ou não informadas.";
      else if (!anttOk) motivo = "Certificação ANTT inválida ou não informada.";
      else motivo = "Certificação Cadastur inválida ou não informada.";
    }
    return res.json({ ok, motivo });
  });

  /** Reserva de veículo: bloqueado se ANTT/Cadastur inválidos (middleware de conformidade). */
  app.post("/api/excursoes/:id/reservar-veiculo", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    if (item.anttValido !== true || item.cadasturValido !== true) {
      return res.status(403).json({
        error: "CONFORMIDADE_VEICULO",
        message: "Reserva de veículo bloqueada: certificação ANTT e/ou Cadastur inválida ou não informada.",
        code: "RESERVA_VEICULO_BLOQUEADA",
      });
    }
    return res.json({ ok: true, message: "Reserva de veículo permitida." });
  });

  /** Dispara alerta Socket.io: Pix expirado em 30 min (para clientes na sala da excursão). */
  app.post("/api/excursoes/:id/alertas/pix-expirado", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const body = (req.body as { passageiroNome?: string; valor?: number }) || {};
    emitPixExpirado(String(req.params.id), body);
    return res.json({ ok: true, message: "Alerta pix-expirado emitido." });
  });

  /** Dispara alerta Socket.io: Vigilância comunitária (Criança/Idoso) — com som no cliente. */
  app.post("/api/excursoes/:id/alertas/vigilancia", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const body = (req.body as { tipo: "crianca" | "idoso"; mensagem?: string }) || {};
    const tipo = body.tipo === "crianca" || body.tipo === "idoso" ? body.tipo : "crianca";
    emitVigilancia(String(req.params.id), tipo, { mensagem: body.mensagem });
    return res.json({ ok: true, message: "Alerta vigilância emitido." });
  });

  app.get("/api/excursoes/:id/stats", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const reservas = await getReservasPorExcursao(String(req.params.id));
    const ocupados = reservas.filter((r) => r.status === "confirmada").length;
    const precoBase = 450;
    const totalPassagens = ocupados * precoBase;
    const totalOpcionais = 0;
    const custosFixos = item.capacidade === 15 ? 2500 : item.capacidade === 28 ? 4000 : 6000;
    const receitaBruta = totalPassagens + totalOpcionais;
    const lucroLiquido = receitaBruta - custosFixos;
    const lucroPorPassageiro = ocupados > 0 ? lucroLiquido / ocupados : 0;
    return res.json({
      receitaBruta,
      totalOpcionais,
      custosFixos,
      lucroLiquido,
      lucroPorPassageiro,
      ocupados,
      capacidade: item.capacidade,
    });
  });

  app.get("/api/excursoes/:id/manifesto-antt", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const passageiros: PassageiroBurocracia[] = (item.wizard?.quem?.passageiros ?? []).map((p) => ({
      nome: p.nome,
      contato: p.contato,
      rg: p.rg,
      cpf: p.cpf,
    }));
    const manifesto = gerarManifestoANTT(
      item.id,
      (item as unknown as Record<string, string>).destino ?? "Caldas Novas",
      item.dataIda,
      item.dataVolta,
      item.veiculoTipo ?? "Ônibus",
      passageiros
    );
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="manifesto-antt-${req.params.id}.json"`);
    res.json(manifesto);
  });

  app.get("/api/excursoes/:id/fnrh", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const passageiros: PassageiroBurocracia[] = (item.wizard?.quem?.passageiros ?? []).map((p) => ({
      nome: p.nome,
      contato: p.contato,
      rg: p.rg,
      cpf: p.cpf,
    }));
    const fnrh = gerarFNRH(
      item.id,
      item.nome,
      item.dataIda,
      item.dataVolta,
      passageiros
    );
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="fnrh-${req.params.id}.json"`);
    res.json(fnrh);
  });

  app.get("/api/excursoes/:id/relatorio-contabil", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const reservas = await getReservasPorExcursao(item.id);
    const dados = reservas.map((r) => ({
      passageiroId: r.passageiroId,
      passageiroNome: r.passageiroNome,
      valorTotal: 450,
      valorPago: r.status === "confirmada" ? 450 : 0,
      status: r.status === "confirmada" ? "pago" as const : r.status === "cancelada" ? "cancelado" as const : "pendente" as const,
    }));
    const relatorio = gerarRelatorioContabil(item.id, item.dataIda, item.dataVolta, dados);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-contabil-${req.params.id}.json"`);
    res.json(relatorio);
  });

  app.get("/api/excursoes/:id/voucher/:passageiroIndex", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada", code: "EXCURSAO_NOT_FOUND" });
    }
    const list = item.wizard?.quem?.passageiros ?? [];
    const idx = parseInt(String(req.params.passageiroIndex), 10);
    if (isNaN(idx) || idx < 0 || idx >= list.length) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Índice de passageiro inválido" });
    }
    const p = list[idx];
    const requesterUserId = req.get("x-user-id");
    if (requesterUserId && requesterUserId !== String(idx)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Sem permissão para acessar o voucher deste passageiro.",
        code: "VOUCHER_FORBIDDEN",
      });
    }
    const group = await ensureGroupForExcursao(item.id, item.nome, item.capacidade);
    const voucherStatus = await recalculateVoucherForGroup(group.id);
    if (!voucherStatus) {
      return res.status(403).json({
        error: "VOUCHER_LOCKED",
        message: "Voucher bloqueado: pagamento mínimo do grupo não atingido (R$500 em pagamentos).",
      });
    }
    const voucher = gerarVoucherVIP(item.id, String(idx), p.nome);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="voucher-${req.params.id}-${idx}.json"`);
    res.json({ voucher, voucherCode: voucherStatus.voucherCode, discount: voucherStatus.discount });
  });

  /** Dispara estado do grupo (votação, lista de espera, passageiros) para a sala da excursão via Socket. Alternativa HTTP ao emit "atualizar-estado-grupo". */
  app.post("/api/excursoes/:id/estado-grupo", async (req: Request, res: Response) => {
    const item = await findExcursao(String(req.params.id));
    if (!item) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Excursão não encontrada",
        code: "EXCURSAO_NOT_FOUND",
      });
    }
    const body = (req.body as {
      votacao?: number[];
      listaEspera?: unknown;
      passageirosCount?: number;
      passageiros?: Array<{ nome: string; contato: string; rg?: string; cpf?: string }>;
    }) || {};
    emitEstadoGrupo(String(req.params.id), {
      votacao: body.votacao,
      listaEspera: body.listaEspera,
      passageirosCount: body.passageirosCount,
      passageiros: body.passageiros,
    });
    return res.json({ ok: true, message: "Estado do grupo emitido." });
  });

  app.post("/api/excursoes/:id/invites", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const invite = await createInvite(group.id);
    const joinUrl = `${req.protocol}://${req.get("host")}/join?code=${encodeURIComponent(invite.code)}`;
    return res.status(201).json({ invite, joinUrl });
  });

  app.post("/api/invites/validate", async (req: Request, res: Response) => {
    const code = String((req.body as { code?: string })?.code ?? "");
    const result = await validateInvite(code);
    if (!result.valid || !result.invite) return res.status(400).json({ ok: false, reason: result.reason });
    return res.json({
      ok: true,
      invite: result.invite,
    });
  });

  app.get("/api/invites/:code", async (req: Request, res: Response) => {
    const code = String(req.params.code ?? "");
    const result = await validateInvite(code);
    if (!result.valid || !result.invite) return res.status(400).json({ ok: false, reason: result.reason });
    const group = await getGroupById(result.invite.groupId);
    if (!group) return res.status(404).json({ ok: false, reason: "GROUP_NOT_FOUND" });
    const excursao = await findExcursao(group.excursaoId);
    return res.json({
      ok: true,
      invite: result.invite,
      group: {
        id: group.id,
        nome: group.nome,
        excursaoId: group.excursaoId,
      },
      excursao,
    });
  });

  app.post("/api/invites/join", async (req: Request, res: Response) => {
    const body = (req.body as { code?: string; userId?: string; nome?: string }) || {};
    if (!body.code || !body.userId || !body.nome) {
      return res.status(400).json({ ok: false, reason: "INVALID_PAYLOAD" });
    }
    const result = await validateInvite(body.code);
    if (!result.valid || !result.invite) return res.status(400).json({ ok: false, reason: result.reason });
    const group = await getGroupById(result.invite.groupId);
    if (!group) return res.status(404).json({ ok: false, reason: "GROUP_NOT_FOUND" });
    await consumeInvite(body.code);
    const membership = await upsertMembership(result.invite.groupId, body.userId, body.nome, "MEMBER");
    return res.json({ ok: true, membership, excursaoId: group.excursaoId });
  });

  app.post("/api/excursoes/:id/solicitar-participacao", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const body = (req.body as { userId?: string; nome?: string }) || {};
    if (!body.userId || !body.nome) return res.status(400).json({ error: "BAD_REQUEST", message: "userId e nome obrigatórios" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const membership = await upsertMembership(group.id, body.userId, body.nome, "PENDING");
    return res.status(201).json({ ok: true, membership });
  });

  app.post("/api/excursoes/:id/creator-setup", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const body = (req.body as { userId?: string; nome?: string }) || {};
    if (!body.userId || !body.nome) return res.status(400).json({ error: "BAD_REQUEST", message: "userId e nome obrigatórios" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const membership = await upsertMembership(group.id, body.userId, body.nome, "ADMIN");
    return res.status(201).json({ ok: true, group, membership });
  });

  app.get("/api/excursoes/:id/me-role", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const sessionUserId = (req.session as any).userId as string | undefined;
    const { userId: headerUserId } = getActorFromHeaders(req);
    const userId = sessionUserId || headerUserId;
    if (!userId) return res.json({ role: null, isAdmin: false });
    const info = await getMembershipRole(excursao, userId);
    return res.json({ role: info?.role ?? null, isAdmin: info?.role === "ADMIN" });
  });

  app.get("/api/excursoes/:id/roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const raw = excursao.wizard?.roteiroOficial ?? {
      veiculoTipo: excursao.veiculoTipo,
      atracoes: [],
      passeios: [],
      parquesAquaticos: [],
      veiculoAutomatico: true,
      manualVehicleOverride: false,
    };
    const atracoesLegacy = Array.isArray(raw.atracoes) ? raw.atracoes : [];
    const passeiosLegacy = Array.isArray(raw.passeios) ? raw.passeios : [];
    const parquesLegacy = Array.isArray(raw.parquesAquaticos) ? raw.parquesAquaticos : [];
    const hoteisCards = normalizeCardsArray(raw.hoteis, "hotel");
    const atracoesCards = normalizeCardsArray(raw.atracoesCards, "atracao");
    const passeiosCards = normalizeCardsArray(raw.passeiosCards, "passeio");
    const parquesCards = normalizeCardsArray(raw.parquesAquaticosCards, "parque");
    const normalizedVehicle = raw.veiculoTipo || excursao.veiculoTipo || toVehicleByCapacity(excursao.capacidade);
    const roteiro = {
      ...raw,
      veiculoTipo: normalizedVehicle,
      veiculoAutomatico: raw.veiculoAutomatico !== false,
      manualVehicleOverride: raw.manualVehicleOverride === true,
      atracoes: atracoesLegacy,
      passeios: passeiosLegacy,
      parquesAquaticos: parquesLegacy,
      hoteis: hoteisCards.length > 0
        ? hoteisCards
        : (raw.hotelPrincipal ? toCardsFromLegacyArray([raw.hotelPrincipal], "hotel") : []),
      atracoesCards: atracoesCards.length > 0 ? atracoesCards : toCardsFromLegacyArray(atracoesLegacy, "atracao"),
      passeiosCards: passeiosCards.length > 0 ? passeiosCards : toCardsFromLegacyArray(passeiosLegacy, "passeio"),
      parquesAquaticosCards: parquesCards.length > 0 ? parquesCards : toCardsFromLegacyArray(parquesLegacy, "parque"),
    };
    return res.json({ roteiro });
  });

  app.patch("/api/excursoes/:id/roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const { userId, nome } = getActorFromHeaders(req);
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const membership = await getMembershipRole(excursao, userId);
    const hasAnyMembership = (await listMemberships(group.id)).length > 0;
    if (membership?.role !== "ADMIN") {
      if (!hasAnyMembership && userId) {
        await upsertMembership(group.id, userId, nome, "ADMIN");
      } else {
        return res.status(403).json({ error: "FORBIDDEN", message: "Somente admin pode editar roteiro oficial" });
      }
    }
    const body = (req.body as RoteiroPayload) || {};
    const prevWizard = excursao.wizard ?? {};
    const prevRoteiro = prevWizard.roteiroOficial ?? {
      veiculoTipo: excursao.veiculoTipo,
      veiculoAutomatico: true,
      manualVehicleOverride: false,
      atracoes: [],
      passeios: [],
      parquesAquaticos: [],
    };
    const atracoesCards = normalizeCardsArray(body.atracoesCards, "atracao");
    const passeiosCards = normalizeCardsArray(body.passeiosCards, "passeio");
    const parquesCards = normalizeCardsArray(body.parquesAquaticosCards, "parque");
    const hoteisCards = normalizeCardsArray(body.hoteis, "hotel");

    const atracoesLegacy = Array.isArray(body.atracoes)
      ? body.atracoes.map((v) => String(v))
      : atracoesCards.length > 0
        ? atracoesCards.map((c) => c.titulo)
        : prevRoteiro.atracoes ?? [];
    const passeiosLegacy = Array.isArray(body.passeios)
      ? body.passeios.map((v) => String(v))
      : passeiosCards.length > 0
        ? passeiosCards.map((c) => c.titulo)
        : prevRoteiro.passeios ?? [];
    const parquesLegacy = Array.isArray(body.parquesAquaticos)
      ? body.parquesAquaticos.map((v) => String(v))
      : parquesCards.length > 0
        ? parquesCards.map((c) => c.titulo)
        : prevRoteiro.parquesAquaticos ?? [];
    const derivedHotelPrincipal = typeof body.hotelPrincipal === "string"
      ? body.hotelPrincipal
      : hoteisCards[0]?.titulo ?? prevRoteiro.hotelPrincipal;

    const veiculoAutomatico = body.veiculoAutomatico !== undefined
      ? body.veiculoAutomatico === true
      : prevRoteiro.veiculoAutomatico !== false;
    const manualVehicleOverride = body.manualVehicleOverride !== undefined
      ? body.manualVehicleOverride === true
      : prevRoteiro.manualVehicleOverride === true;
    const autoVehicle = toVehicleByCapacity(excursao.capacidade);
    const requestedVehicle = typeof body.veiculoTipo === "string" ? body.veiculoTipo : undefined;
    const vehicleFromRule = manualVehicleOverride && requestedVehicle
      ? requestedVehicle
      : (veiculoAutomatico ? autoVehicle : (requestedVehicle || prevRoteiro.veiculoTipo || autoVehicle));

    const roteiro = {
      ...prevRoteiro,
      ...body,
      veiculoTipo: vehicleFromRule,
      veiculoAutomatico,
      manualVehicleOverride,
      hotelPrincipal: derivedHotelPrincipal,
      atracoes: atracoesLegacy,
      passeios: passeiosLegacy,
      parquesAquaticos: parquesLegacy,
      hoteis: hoteisCards.length > 0 ? hoteisCards : normalizeCardsArray(prevRoteiro.hoteis, "hotel"),
      atracoesCards: atracoesCards.length > 0 ? atracoesCards : normalizeCardsArray(prevRoteiro.atracoesCards, "atracao"),
      passeiosCards: passeiosCards.length > 0 ? passeiosCards : normalizeCardsArray(prevRoteiro.passeiosCards, "passeio"),
      parquesAquaticosCards: parquesCards.length > 0 ? parquesCards : normalizeCardsArray(prevRoteiro.parquesAquaticosCards, "parque"),
      updatedByAdminAt: new Date().toISOString(),
      publishedAt: body.publish ? new Date().toISOString() : prevRoteiro.publishedAt,
    };
    const updated = await updateExcursao(excursao.id, {
      veiculoTipo: roteiro.veiculoTipo ?? excursao.veiculoTipo,
      wizard: { ...prevWizard, roteiroOficial: roteiro },
    });
    return res.json({ ok: true, roteiro: updated?.wizard?.roteiroOficial ?? roteiro });
  });

  app.get("/api/excursoes/:id/catalogo-roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    return res.json({ items: getCatalogo(excursao) });
  });

  app.post("/api/excursoes/:id/catalogo-roteiro/:categoria", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const categoria = normalizeCatalogCategory(String(req.params.categoria || ""));
    if (!categoria) return res.status(400).json({ error: "BAD_REQUEST", message: "Categoria inválida" });
    const body = (req.body as Partial<RoteiroCatalogCard>) || {};
    const normalized = normalizeCard(body, `catalogo-${categoria}`);
    if (!normalized) return res.status(400).json({ error: "BAD_REQUEST", message: "Título obrigatório" });
    const now = new Date().toISOString();
    const catalogoAtual = getCatalogo(excursao);
    const item: RoteiroCatalogCard = { ...normalized, createdAt: now, updatedAt: now };
    const next = {
      ...catalogoAtual,
      [categoria]: [item, ...catalogoAtual[categoria]],
      updatedAt: now,
    };
    await updateExcursao(excursao.id, {
      wizard: {
        ...(excursao.wizard ?? {}),
        catalogoRoteiro: next,
      },
    });
    return res.status(201).json({ ok: true, item, categoria });
  });

  app.patch("/api/excursoes/:id/catalogo-roteiro/:categoria/:itemId", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const categoria = normalizeCatalogCategory(String(req.params.categoria || ""));
    if (!categoria) return res.status(400).json({ error: "BAD_REQUEST", message: "Categoria inválida" });
    const itemId = String(req.params.itemId || "");
    const catalogoAtual = getCatalogo(excursao);
    const arr = [...catalogoAtual[categoria]];
    const idx = arr.findIndex((i) => i.id === itemId);
    if (idx < 0) return res.status(404).json({ error: "NOT_FOUND", message: "Item não encontrado" });
    const body = (req.body as Partial<RoteiroCatalogCard>) || {};
    const merged = normalizeCard({ ...arr[idx], ...body, id: arr[idx].id }, `catalogo-${categoria}`);
    if (!merged) return res.status(400).json({ error: "BAD_REQUEST", message: "Título obrigatório" });
    const now = new Date().toISOString();
    arr[idx] = { ...merged, createdAt: arr[idx].createdAt, updatedAt: now };
    const next = { ...catalogoAtual, [categoria]: arr, updatedAt: now };
    await updateExcursao(excursao.id, {
      wizard: {
        ...(excursao.wizard ?? {}),
        catalogoRoteiro: next,
      },
    });
    return res.json({ ok: true, item: arr[idx], categoria });
  });

  app.delete("/api/excursoes/:id/catalogo-roteiro/:categoria/:itemId", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const categoria = normalizeCatalogCategory(String(req.params.categoria || ""));
    if (!categoria) return res.status(400).json({ error: "BAD_REQUEST", message: "Categoria inválida" });
    const itemId = String(req.params.itemId || "");
    const catalogoAtual = getCatalogo(excursao);
    const nextItems = catalogoAtual[categoria].filter((i) => i.id !== itemId);
    if (nextItems.length === catalogoAtual[categoria].length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Item não encontrado" });
    }
    const now = new Date().toISOString();
    const next = { ...catalogoAtual, [categoria]: nextItems, updatedAt: now };
    await updateExcursao(excursao.id, {
      wizard: {
        ...(excursao.wizard ?? {}),
        catalogoRoteiro: next,
      },
    });
    return res.json({ ok: true, categoria, removedId: itemId });
  });

  app.post("/api/excursoes/:id/sugestoes-roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const { userId, nome } = getActorFromHeaders(req);
    if (!userId) return res.status(400).json({ error: "BAD_REQUEST", message: "x-user-id obrigatório" });
    const info = await getMembershipRole(excursao, userId);
    if (!info || !info.role || info.role === "REJEITADO" || info.role === "PENDENTE") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Somente membros aprovados podem sugerir" });
    }
    const body = (req.body as { categoria?: "veiculo" | "hotel" | "atracao" | "passeio" | "parque" | "outro"; valor?: string; descricao?: string }) || {};
    if (!body.categoria || !body.valor) return res.status(400).json({ error: "BAD_REQUEST", message: "categoria e valor obrigatórios" });
    const prevWizard = excursao.wizard ?? {};
    const prev = prevWizard.sugestoesRoteiro ?? [];
    const now = new Date().toISOString();
    const sugestao = {
      id: `sug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      nomeAutor: nome,
      categoria: body.categoria,
      valor: body.valor,
      descricao: body.descricao,
      status: "PENDENTE" as const,
      publishedForVoting: false,
      createdAt: now,
      updatedAt: now,
    };
    await updateExcursao(excursao.id, {
      wizard: { ...prevWizard, sugestoesRoteiro: [sugestao, ...prev] },
    });
    return res.status(201).json({ ok: true, sugestao });
  });

  app.get("/api/excursoes/:id/sugestoes-roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const { userId } = getActorFromHeaders(req);
    const isAdmin = await isAdminForExcursao(excursao, userId);
    if (!isAdmin) return res.status(403).json({ error: "FORBIDDEN", message: "Somente admin pode moderar sugestões" });
    return res.json({ items: excursao.wizard?.sugestoesRoteiro ?? [] });
  });

  app.patch("/api/excursoes/:id/sugestoes-roteiro/:sugestaoId", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const { userId } = getActorFromHeaders(req);
    if (!(await isAdminForExcursao(excursao, userId))) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Somente admin pode moderar sugestões" });
    }
    const body = (req.body as { status?: "APROVADA" | "REJEITADA"; publishForVoting?: boolean }) || {};
    if (!body.status) return res.status(400).json({ error: "BAD_REQUEST", message: "status obrigatório" });
    const prevWizard = excursao.wizard ?? {};
    const sugestoes = [...(prevWizard.sugestoesRoteiro ?? [])];
    const idx = sugestoes.findIndex((s) => s.id === String(req.params.sugestaoId));
    if (idx < 0) return res.status(404).json({ error: "NOT_FOUND", message: "Sugestão não encontrada" });
    const now = new Date().toISOString();
    sugestoes[idx] = {
      ...sugestoes[idx],
      status: body.status,
      publishedForVoting: body.status === "APROVADA" && body.publishForVoting === true,
      updatedAt: now,
    };
    const votacao = prevWizard.votacaoRoteiro ?? { items: [], updatedAt: now };
    if (sugestoes[idx].publishedForVoting) {
      const exists = votacao.items.some((i) => i.id === sugestoes[idx].id);
      if (!exists) {
        votacao.items.push({
          id: sugestoes[idx].id,
          categoria: sugestoes[idx].categoria,
          valor: sugestoes[idx].valor,
          votos: 0,
        });
      }
    }
    votacao.updatedAt = now;
    const updated = await updateExcursao(excursao.id, {
      wizard: { ...prevWizard, sugestoesRoteiro: sugestoes, votacaoRoteiro: votacao },
    });
    return res.json({ ok: true, sugestao: sugestoes[idx], votacao: updated?.wizard?.votacaoRoteiro ?? votacao });
  });

  app.get("/api/excursoes/:id/votacao-roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    return res.json({ items: excursao.wizard?.votacaoRoteiro?.items ?? [] });
  });

  app.post("/api/excursoes/:id/votacao-roteiro", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const { userId } = getActorFromHeaders(req);
    if (!userId) return res.status(400).json({ error: "BAD_REQUEST", message: "x-user-id obrigatório" });
    const info = await getMembershipRole(excursao, userId);
    if (!info || !info.role || info.role === "REJEITADO" || info.role === "PENDENTE") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Somente membros aprovados podem votar" });
    }
    const itemId = String((req.body as { itemId?: string })?.itemId ?? "");
    if (!itemId) return res.status(400).json({ error: "BAD_REQUEST", message: "itemId obrigatório" });
    const prevWizard = excursao.wizard ?? {};
    const votacao = prevWizard.votacaoRoteiro ?? { items: [], updatedAt: new Date().toISOString() };
    const idx = votacao.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return res.status(404).json({ error: "NOT_FOUND", message: "Item de votação não encontrado" });
    votacao.items[idx] = { ...votacao.items[idx], votos: (votacao.items[idx].votos ?? 0) + 1 };
    votacao.updatedAt = new Date().toISOString();
    await updateExcursao(excursao.id, {
      wizard: { ...prevWizard, votacaoRoteiro: votacao },
    });
    return res.json({ ok: true, item: votacao.items[idx], items: votacao.items });
  });

  app.get("/api/excursoes/:id/solicitacoes", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const pendentes = await listMemberships(group.id, "PENDENTE");
    return res.json({ items: pendentes });
  });

  app.get("/api/excursoes/:id/solicitacoes/resumo", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const all = await listMemberships(group.id);
    const periodRaw = String(req.query.period ?? "today");
    const period = periodRaw === "today" || periodRaw === "7d" || periodRaw === "30d" ? periodRaw : "today";
    const now = Date.now();
    const hoje = new Date(now).toDateString();
    const inPeriod = (value?: string) => {
      const ts = new Date(value || "").getTime();
      if (!Number.isFinite(ts)) return false;
      if (period === "today") return new Date(ts).toDateString() === hoje;
      const days = period === "7d" ? 7 : 30;
      const diff = now - ts;
      return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
    };
    const pendentes = all.filter((m) => m.status === "PENDENTE").length;
    const aprovadosPeriodo = all.filter((m) => m.status === "MEMBER" && inPeriod(m.updatedAt || m.createdAt)).length;
    const reprovadosPeriodo = all.filter((m) => m.status === "REJEITADO" && inPeriod(m.updatedAt || m.createdAt)).length;
    return res.json({ pendentes, aprovadosPeriodo, reprovadosPeriodo, period });
  });

  app.patch("/api/excursoes/:id/solicitacoes/:userId", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const body = (req.body as { aprovar?: boolean; nome?: string }) || {};
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const membership = await upsertMembership(
      group.id,
      String(req.params.userId),
      body.nome || "Membro",
      body.aprovar === false ? "REJEITADO" : "MEMBER",
    );
    return res.json({ ok: true, membership });
  });

  app.post("/api/excursoes/:id/clonar", async (req: Request, res: Response) => {
    const origem = await findExcursao(String(req.params.id));
    if (!origem) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão base não encontrada" });
    const body = (req.body as Partial<Excursao>) || {};
    const nova = await createExcursao({
      nome: body.nome || `${origem.nome} - Minha Excursão`,
      dataIda: body.dataIda || origem.dataIda,
      dataVolta: body.dataVolta || origem.dataVolta,
      destino: body.destino || origem.destino,
      localSaida: body.localSaida || origem.localSaida || "A definir",
      capacidade: body.capacidade ?? origem.capacidade,
      veiculoTipo: body.veiculoTipo || origem.veiculoTipo,
      status: "rascunho",
      wizard: origem.wizard,
      anttNumero: undefined,
      anttValido: false,
      cadasturNumero: undefined,
      cadasturValido: false,
    });
    const group = await ensureGroupForExcursao(nova.id, nova.nome, nova.capacidade);
    await createInvite(group.id);
    return res.status(201).json(nova);
  });

  app.patch("/api/excursoes/:id/orders/:userId", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.id));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const body = (req.body as { totalAmount?: number; paidAmount?: number; hotelId?: string }) || {};
    const order = await upsertOrder(group.id, String(req.params.userId), {
      totalAmount: body.totalAmount ?? 0,
      paidAmount: body.paidAmount ?? 0,
    });
    const voucher = await recalculateVoucherForGroup(group.id);
    return res.json({ order, voucher });
  });

  app.get("/api/admin/stats/:excursaoId", async (req: Request, res: Response) => {
    const excursao = await findExcursao(String(req.params.excursaoId));
    if (!excursao) return res.status(404).json({ error: "NOT_FOUND", message: "Excursão não encontrada" });
    const group = await ensureGroupForExcursao(excursao.id, excursao.nome, excursao.capacidade);
    const orders = await listOrders(group.id);
    const membros = await listMemberships(group.id, "MEMBER");
    const receita = orders.reduce((acc, o) => acc + o.paidAmount, 0);
    const custos = excursao.capacidade <= 15 ? 2500 : excursao.capacidade <= 28 ? 4000 : 6000;
    const lucro = receita - custos;
    const lucroPorPoltrona = membros.length > 0 ? lucro / membros.length : 0;
    return res.json({
      receita,
      custos,
      lucro,
      lucroPorPoltrona,
      ocupados: membros.length,
      capacidade: excursao.capacidade,
      alertaUpgradeFrota: membros.length >= 15,
    });
  });

  app.get("/api/admin/solicitacoes/resumo", async (req: Request, res: Response) => {
    const periodRaw = String(req.query.period ?? "today");
    const period = periodRaw === "today" || periodRaw === "7d" || periodRaw === "30d" ? periodRaw : "today";
    const now = Date.now();
    const hoje = new Date(now).toDateString();
    const inPeriod = (value?: string) => {
      const ts = new Date(value || "").getTime();
      if (!Number.isFinite(ts)) return false;
      if (period === "today") return new Date(ts).toDateString() === hoje;
      const days = period === "7d" ? 7 : 30;
      const diff = now - ts;
      return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
    };

    const excursoes = await listExcursoes();
    const grupos = await Promise.all(
      excursoes.map((e) => ensureGroupForExcursao(e.id, e.nome, e.capacidade)),
    );
    const membershipsByGroup = await Promise.all(grupos.map((g) => listMemberships(g.id)));
    const all = membershipsByGroup.flat();

    const pendentes = all.filter((m) => m.status === "PENDENTE").length;
    const aprovadosPeriodo = all.filter((m) => m.status === "MEMBER" && inPeriod(m.updatedAt || m.createdAt)).length;
    const reprovadosPeriodo = all.filter((m) => m.status === "REJEITADO" && inPeriod(m.updatedAt || m.createdAt)).length;

    return res.json({
      pendentes,
      aprovadosPeriodo,
      reprovadosPeriodo,
      period,
      totalExcursoes: excursoes.length,
    });
  });

  // ─────────────────────────────────────────────
  // NTX — WaaS (WhatsApp as a Service)
  // ─────────────────────────────────────────────
  app.get("/api/waas/status", requireAdmin, (_req: Request, res: Response) => {
    res.json(getWaasStatus());
  });

  app.post("/api/waas/instancia", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await createInstance();
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.get("/api/waas/instancia/status", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await getInstanceStatus();
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.get("/api/waas/instancia/qrcode", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await getQRCode();
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/waas/instancia", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await deleteInstance();
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/waas/webhook", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const rawApikey = req.headers["apikey"] || req.query["apikey"];
    const apikey = Array.isArray(rawApikey) ? rawApikey[0] : String(rawApikey || "");
    if (process.env.EVOLUTION_API_KEY && apikey !== process.env.EVOLUTION_API_KEY) {
      return res.status(401).json({ error: "Unauthorized webhook" });
    }
    const event = (body?.event as string) || "unknown";
    const data = (body?.data as Record<string, unknown>) || body;
    handleWebhookEvent(event, data);
    return res.json({ received: true });
  });

  app.get("/api/waas/grupos", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await fetchAllGroups();
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/waas/criar-grupo", async (req: Request, res: Response) => {
    const { name, phone } = req.body as { name?: string; phone?: string };
    if (!name || !phone) return res.status(400).json({ error: "name e phone são obrigatórios" });
    try {
      const result = await createExcursionGroup(name, phone);
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/waas/:excursaoId/mensagem", async (req: Request, res: Response) => {
    const excursaoId = String(req.params.excursaoId);
    const { text } = req.body as { text?: string };
    if (!text) return res.status(400).json({ error: "text é obrigatório" });
    try {
      const result = await sendTextToGroup(excursaoId, text);
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/waas/:excursaoId/enquete", async (req: Request, res: Response) => {
    const excursaoId = String(req.params.excursaoId);
    const { question, options } = req.body as { question?: string; options?: string[] };
    if (!question || !options?.length) return res.status(400).json({ error: "question e options são obrigatórios" });
    try {
      const result = await sendPollToGroup(excursaoId, question, options);
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.get("/api/waas/:excursaoId/status", (req: Request, res: Response) => {
    const excursaoId = String(req.params.excursaoId);
    res.json({ excursaoId, aiPaused: isAIPaused(excursaoId), handoff: getHandoffInfo(excursaoId) });
  });

  // ─────────────────────────────────────────────
  // NTX — Split Pix Payment
  // ─────────────────────────────────────────────
  app.post("/api/pagamento/gerar-pix", async (req: Request, res: Response) => {
    const { excursaoId, amount, passengerName, organizerCommission } = req.body as {
      excursaoId?: string; amount?: number; passengerName?: string; organizerCommission?: number;
    };
    if (!excursaoId || !amount || !passengerName) return res.status(400).json({ error: "excursaoId, amount e passengerName são obrigatórios" });
    try {
      const result = await createSplitPaymentPix(amount, excursaoId, passengerName, organizerCommission ?? 0);
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.get("/api/pagamento/status/:transactionId", async (req: Request, res: Response) => {
    const transactionId = String(req.params.transactionId);
    try {
      const result = await checkPaymentStatus(transactionId);
      return res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/webhook/payment", async (req: Request, res: Response) => {
    const webhookSecret = process.env.WEBHOOK_PAYMENT_SECRET;
    if (webhookSecret) {
      const provided = req.headers["x-webhook-secret"] as string | undefined;
      if (!provided || provided.length !== webhookSecret.length) {
        return res.status(401).json({ error: "Unauthorized: invalid webhook secret" });
      }
      const a = Buffer.from(provided, "utf8");
      const b = Buffer.from(webhookSecret, "utf8");
      if (!timingSafeEqual(a, b)) {
        return res.status(401).json({ error: "Unauthorized: invalid webhook secret" });
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("[Webhook] WEBHOOK_PAYMENT_SECRET not configured in production — rejecting request");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    const { event, data } = req.body as {
      event?: string;
      data?: {
        id: string;
        metadata?: { orderId?: string; userId?: string };
        customer?: { name: string };
        amount?: number;
      };
    };
    if (event === "transaction.paid" && data) {
      const transactionId = data.id;
      const alreadyProcessed = await mutateDb((db) => {
        if (!db.processedTransactions) db.processedTransactions = {};
        const processed = db.processedTransactions as Record<string, boolean>;
        if (processed[transactionId]) return true;
        processed[transactionId] = true;
        return false;
      });
      if (alreadyProcessed) return res.json({ received: true, duplicate: true });

      const excursaoId = data.metadata?.orderId ?? "";
      const rawName = data.customer?.name ?? "Passageiro";
      const passengerName = rawName.trim();
      const amount = (data.amount ?? 0) / 100;
      await sendPaymentConfirmation(excursaoId, passengerName, amount).catch(() => {});
      emitEstadoGrupo(excursaoId, { type: "pagamento_confirmado", transactionId, passengerName, amount });
      await mutateDb((db) => {
        db.gamificationExtraSeats = ((db.gamificationExtraSeats as number) ?? 0) + 1;
      });
      const pontos = Math.round(amount);
      if (pontos > 0) {
        let userFound;
        if (data.metadata?.userId) {
          userFound = await storage.getUser(data.metadata.userId).catch(() => undefined);
        }
        if (!userFound) {
          userFound = await storage.getUserByNome(passengerName).catch(() => undefined);
        }
        if (userFound) {
          await adicionarPontos(userFound.id, pontos, `Pagamento PIX — Excursão`).catch((e) =>
            console.error("[Gamification] Falha ao adicionar pontos:", e)
          );
        } else {
          console.warn(`[Gamification] Usuário não encontrado para passageiro "${passengerName}" (txn: ${transactionId}). Pontos não foram atribuídos.`);
        }
      }
    }
    return res.json({ received: true });
  });

  // ─────────────────────────────────────────────
  // NTX — Live Chat Handoff
  // ─────────────────────────────────────────────
  app.post("/api/handoff/:groupId/pausar", (req: Request, res: Response) => {
    const groupId = String(req.params.groupId);
    const { operatorId } = req.body as { operatorId?: string };
    const result = pauseAI(groupId, operatorId ?? "op-unknown");
    return res.json(result);
  });

  app.post("/api/handoff/:groupId/retomar", (req: Request, res: Response) => {
    const groupId = String(req.params.groupId);
    const result = resumeAI(groupId);
    return res.json(result);
  });

  app.get("/api/handoff/pausados", (_req: Request, res: Response) => {
    return res.json(listPausedGroups());
  });

  // ─────────────────────────────────────────────
  // NTX — Gamification / Organizer Goals
  // ─────────────────────────────────────────────
  interface GamificationGoalDef {
    id: string;
    nivel: number;
    title: string;
    description: string;
    targetSeats: number;
    rewardType: "CORTESIA" | "CASHBACK" | "UPGRADE_DIVERSAO";
    rewardValue: string;
  }

  const GOAL_DEFINITIONS: GamificationGoalDef[] = [
    { id: "g1", nivel: 1, title: "Kit Conforto para 2 Pessoas", description: "Venda 15 vagas e ganhe um Kit Conforto 100% grátis para você e seu acompanhante.", targetSeats: 15, rewardType: "CORTESIA", rewardValue: "Kit conforto para 2 pessoas — 100% grátis" },
    { id: "g2", nivel: 2, title: "Ingresso Lagoa Termas Parque", description: "Venda 10 vagas e ganhe um ingresso 100% grátis para a Lagoa Termas Parque.", targetSeats: 10, rewardType: "UPGRADE_DIVERSAO", rewardValue: "Ingresso Lagoa Termas Parque — 100% grátis" },
    { id: "g3", nivel: 3, title: "Viagem 50% de Desconto", description: "Venda 30 vagas no acumulado do mês e garanta 50% de desconto na sua passagem.", targetSeats: 30, rewardType: "CASHBACK", rewardValue: "50% de desconto para 1 passageiro" },
  ];

  type ClaimedGoals = Record<string, string[]>;

  async function getGamificationClaimed(): Promise<ClaimedGoals> {
    return mutateDb((db) => {
      if (!db.gamificationClaimed) db.gamificationClaimed = {};
      return db.gamificationClaimed as ClaimedGoals;
    });
  }

  async function getTotalConfirmedSeats(): Promise<number> {
    return mutateDb((db) => {
      const reservas = (db.reservaStore as Array<{ status: string }>) ?? [];
      return reservas.filter((r) => r.status === "confirmada").length;
    });
  }

  async function getGamificationExtraSeats(): Promise<number> {
    return mutateDb((db) => {
      return (db.gamificationExtraSeats as number) ?? 0;
    });
  }

  app.get("/api/organizador/:userId/metas", async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const confirmedSeats = await getTotalConfirmedSeats();
    const extraSeats = await getGamificationExtraSeats();
    const totalSeats = confirmedSeats + extraSeats;
    const claimed = await getGamificationClaimed();
    const userClaimed = claimed[userId] ?? [];

    const goals = GOAL_DEFINITIONS.map((def) => {
      const isClaimed = userClaimed.includes(def.id);
      const achieved = totalSeats;
      const isUnlocked = achieved >= def.targetSeats;
      return {
        id: def.id,
        nivel: def.nivel,
        title: def.title,
        description: def.description,
        targetSeats: def.targetSeats,
        achievedSeats: achieved,
        rewardType: def.rewardType,
        rewardValue: def.rewardValue,
        status: isClaimed ? "CLAIMED" : isUnlocked ? "UNLOCKED" : "LOCKED",
      };
    });

    return res.json({ goals, totalSeats });
  });

  app.patch("/api/organizador/metas/:id/resgatar", async (req: Request, res: Response) => {
    const goalId = String(req.params.id);
    const userId = req.session?.userId ?? "anonymous";
    const goalDef = GOAL_DEFINITIONS.find((g) => g.id === goalId);
    if (!goalDef) return res.status(404).json({ error: "Meta não encontrada" });

    const confirmedSeats = await getTotalConfirmedSeats();
    const extraSeats = await getGamificationExtraSeats();
    const totalSeats = confirmedSeats + extraSeats;
    if (totalSeats < goalDef.targetSeats) return res.status(400).json({ error: "Meta ainda não atingida" });

    await mutateDb((db) => {
      if (!db.gamificationClaimed) db.gamificationClaimed = {};
      const claimed = db.gamificationClaimed as ClaimedGoals;
      if (!claimed[userId]) claimed[userId] = [];
      if (!claimed[userId].includes(goalId)) claimed[userId].push(goalId);
    });

    return res.json({ success: true, message: "Recompensa registrada. Entraremos em contato em até 48h." });
  });

  // ─────────────────────────────────────────────
  // NTX — Passenger Gamification (Pontos / Conquistas / Ranking) — PostgreSQL
  // ─────────────────────────────────────────────

  app.get("/api/gamification/pontos", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.json({ pontos: 0, streak: 0, nome: "Visitante" });
    const user = await storage.getUser(userId);
    const nome = user?.nome ?? "Visitante";

    try {
      const { pontos, streak } = await getPontos(userId);
      return res.json({ pontos, streak, nome });
    } catch (e) {
      console.error("[Gamification] getPontos error:", e);
      return res.json({ pontos: 0, streak: 0, nome });
    }
  });

  app.get("/api/gamification/historico", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.json({ historico: [] });

    try {
      const historico = await getHistorico(userId);
      return res.json({ historico });
    } catch (e) {
      console.error("[Gamification] getHistorico error:", e);
      return res.json({ historico: [] });
    }
  });

  app.get("/api/gamification/conquistas", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.json({ conquistas: CONQUISTAS_DEFS_SERVICE.map(c => ({ ...c, desbloqueada: false })) });
    }
    const user = await storage.getUser(userId);
    const nome = user?.nome ?? "Visitante";

    try {
      const excursoes = await listExcursoes();
      const { pontos } = await getPontos(userId);

      const reservas = await mutateDb((db) => {
        const rs = (db.reservaStore as Array<{ passageiroNome: string; status: string; excursaoId: string }>) ?? [];
        return rs.filter(r => r.passageiroNome === nome && r.status === "confirmada");
      });
      const memberships = await mutateDb((db) => {
        return (db.membershipStore as Array<{ groupId: string; userId: string; status: string }>) ?? [];
      });

      const distinctTrips = Array.from(new Set(reservas.map(r => r.excursaoId)));
      const caldasCount = distinctTrips.filter(excId => {
        const exc = excursoes.find(e => e.id === excId);
        return exc?.destino?.toLowerCase().includes("caldas") ?? false;
      }).length;
      let inGroupOf5 = false;
      for (const excId of distinctTrips) {
        const groupId = `grp-${excId}`;
        const groupMembers = memberships.filter(m => m.groupId === groupId && (m.status === "MEMBER" || m.status === "ADMIN"));
        if (groupMembers.length >= 5) { inGroupOf5 = true; break; }
      }

      const conquistas = await getConquistas(userId, {
        pontos,
        confirmedCount: distinctTrips.length,
        caldasCount,
        inGroupOf5,
      });

      return res.json({ conquistas });
    } catch (e) {
      console.error("[Gamification] getConquistas error:", e);
      return res.json({ conquistas: CONQUISTAS_DEFS_SERVICE.map(c => ({ ...c, desbloqueada: false })) });
    }
  });

  app.get("/api/gamification/ranking-organizadores", async (_req: Request, res: Response) => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const ranking = await mutateDb((db) => {
      const reservas = (db.reservaStore as Array<{ excursaoId: string; status: string; criadaEm: Date }>) ?? [];
      const memberships = (db.membershipStore as Array<{ groupId: string; userId: string; nome: string; status: string }>) ?? [];

      const confirmedThisMonth = reservas.filter(r => {
        if (r.status !== "confirmada") return false;
        const d = new Date(r.criadaEm);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      });

      const orgMap: Record<string, { nome: string; vagas: number }> = {};
      for (const r of confirmedThisMonth) {
        const groupId = `grp-${r.excursaoId}`;
        const admins = memberships.filter(m => m.groupId === groupId && m.status === "ADMIN");
        for (const admin of admins) {
          if (!orgMap[admin.userId]) orgMap[admin.userId] = { nome: admin.nome, vagas: 0 };
          orgMap[admin.userId].vagas++;
        }
      }

      return Object.values(orgMap).sort((a, b) => b.vagas - a.vagas).slice(0, 10);
    });

    return res.json({ ranking });
  });

  // ─────────────────────────────────────────────
  // NTX — Analytics pageview + Fase 12 events batch
  // ─────────────────────────────────────────────
  app.post("/api/analytics/pageview", (req: Request, res: Response) => {
    const { slug, page } = req.body as { slug?: string; page?: string };
    console.log(`[Analytics] pageview: ${page ?? "?"} / ${slug ?? "?"} at ${new Date().toISOString()}`);
    return res.json({ ok: true });
  });

  app.post("/api/analytics/events", async (req: Request, res: Response) => {
    const { ingestAnalyticsEvents } = await import("./services/analytics-events.service.js");
    const body = req.body as { events?: unknown };
    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length === 0) {
      return res.status(400).json({ message: "events[] é obrigatório", code: "ANALYTICS_EMPTY" });
    }
    if (events.length > 50) {
      return res.status(400).json({ message: "Máximo 50 eventos por lote", code: "ANALYTICS_BATCH_LIMIT" });
    }
    const result = ingestAnalyticsEvents(events as Parameters<typeof ingestAnalyticsEvents>[0]);
    return res.status(202).json({ ok: true, ...result });
  });

  app.get("/api/analytics/recent", async (req: Request, res: Response) => {
    const { listRecentAnalytics, analyticsStats } = await import(
      "./services/analytics-events.service.js"
    );
    const limit = parseInt(String(req.query.limit ?? "50"), 10) || 50;
    return res.json({
      items: listRecentAnalytics(limit),
      stats: analyticsStats(),
    });
  });

  // ─────────────────────────────────────────────
  // NTX — Landing Pages
  // ─────────────────────────────────────────────
  app.get("/api/excursoes/landing/:slug", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const excursoes = await listExcursoes();
    const excursao = excursoes.find((e) => e.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") === slug);
    if (!excursao) return res.status(404).json({ error: "Landing page não encontrada" });
    return res.json({ slug, excursaoId: excursao.id, nome: excursao.nome, price: 890 });
  });

  // ─────────────────────────────────────────────
  // Atividades do Wizard (CRUD)
  // ─────────────────────────────────────────────
  app.get("/api/atividades-wizard", async (_req: Request, res: Response) => {
    const items = await storage.listAtividadesWizard();
    return res.json({ items });
  });

  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const u = await storage.getUser(req.session.userId);
    if (!u || u.role !== "admin") {
      return res.status(403).json({ message: "Acesso restrito a administradores" });
    }
    return next();
  }

  app.post("/api/atividades-wizard", requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertAtividadeWizardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    const created = await storage.createAtividadeWizard(parsed.data);
    return res.status(201).json(created);
  });

  app.patch("/api/atividades-wizard/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await storage.getAtividadeWizard(id);
    if (!existing) return res.status(404).json({ message: "Atividade não encontrada" });
    const partial = insertAtividadeWizardSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ message: partial.error.issues[0].message });
    const updated = await storage.updateAtividadeWizard(id, partial.data);
    return res.json(updated);
  });

  app.delete("/api/atividades-wizard/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const deleted = await storage.deleteAtividadeWizard(id);
    if (!deleted) return res.status(404).json({ message: "Atividade não encontrada" });
    return res.status(204).send();
  });

  // =============================================
  // INGRESSOS — TICKET PAYMENT ROUTES
  // =============================================

  const ticketTransactions = new Map<string, {
    transactionId: string;
    status: "PENDING" | "APPROVED" | "EXPIRED" | "FAILED" | "CANCELLED";
    totalAmount: number;
    originalTotal: number;
    totalSavings: number;
    isCombo: boolean;
    items: Array<{ ticketId: string; title: string; quantity: number; unitPrice: number }>;
    customer: { name: string; email: string; cpf: string; phone: string };
    qrCodeBase64: string;
    copyPasteCode: string;
    expirationDate: string;
    createdAt: string;
    demo: boolean;
    voucherId: string;
    voucherToken: string;
  }>();

  // ── Fase 5: locks atômicos + hold timer de ingressos ──────────────────────
  app.get("/api/tickets/availability", (req: Request, res: Response) => {
    const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = idsParam
      ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    return res.json({
      ttlMs: TICKET_HOLD_TTL_MS,
      tickets: getAvailabilitySnapshot(ids),
    });
  });

  app.post("/api/tickets/holds", (req: Request, res: Response) => {
    const { sessionId, items } = req.body as {
      sessionId?: string;
      items?: Array<{ ticketId?: string; quantity?: number }>;
    };
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ message: "sessionId é obrigatório" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items é obrigatório" });
    }
    try {
      const hold = acquireHold(
        sessionId,
        items.map((i) => ({
          ticketId: String(i.ticketId ?? ""),
          quantity: Number(i.quantity ?? 0),
        })),
      );
      logger.info("[tickets/holds] Hold adquirido", {
        holdId: hold.holdId,
        sessionId: hold.sessionId,
        expiresAt: hold.expiresAt,
        items: hold.items.length,
      });
      return res.status(201).json(hold);
    } catch (err) {
      if (err instanceof InsufficientInventoryError) {
        return res.status(409).json({
          message: err.message,
          ticketId: err.ticketId,
          requested: err.requested,
          available: err.available,
          code: "INSUFFICIENT_INVENTORY",
        });
      }
      if (err instanceof HoldConflictError) {
        return res.status(400).json({ message: err.message, code: "HOLD_CONFLICT" });
      }
      logger.error("[tickets/holds] Erro ao adquirir hold", {
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(500).json({ message: "Erro ao reservar ingressos" });
    }
  });

  app.get("/api/tickets/holds/:holdId", (req: Request, res: Response) => {
    const hold = getHold(String(req.params.holdId));
    if (!hold) return res.status(404).json({ message: "Hold não encontrado" });
    return res.json(hold);
  });

  app.post("/api/tickets/holds/:holdId/refresh", (req: Request, res: Response) => {
    try {
      const hold = refreshHold(String(req.params.holdId));
      return res.json(hold);
    } catch (err) {
      if (err instanceof HoldNotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      if (err instanceof HoldConflictError) {
        return res.status(409).json({ message: err.message, code: "HOLD_CONFLICT" });
      }
      return res.status(500).json({ message: "Erro ao renovar hold" });
    }
  });

  app.delete("/api/tickets/holds/:holdId", (req: Request, res: Response) => {
    try {
      const hold = releaseHold(String(req.params.holdId));
      return res.json(hold);
    } catch (err) {
      if (err instanceof HoldNotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      if (err instanceof HoldConflictError) {
        return res.status(409).json({ message: err.message, code: "HOLD_CONFLICT" });
      }
      return res.status(500).json({ message: "Erro ao liberar hold" });
    }
  });

  app.post("/api/payments/tickets/create", async (req: Request, res: Response) => {
    const { items, customer, holdId, sessionId } = req.body as {
      items?: Array<{ ticketId: string; quantity: number }>;
      customer?: { name: string; email: string; cpf: string; phone: string };
      holdId?: string;
      sessionId?: string;
    };
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items é obrigatório" });
    }
    const invalidItems = items.filter(
      (i) => typeof i.ticketId !== "string" || !i.ticketId || typeof i.quantity !== "number" || i.quantity < 1
    );
    if (invalidItems.length > 0) {
      return res.status(400).json({ message: "Cada item deve ter ticketId e quantity válidos" });
    }
    if (!customer?.name || !customer?.email) {
      return res.status(400).json({ message: "Dados do cliente são obrigatórios" });
    }

    const {
      normalizeIdempotencyKey,
      fingerprintTicketCreatePayload,
      lookupIdempotentPayment,
      storeIdempotentPayment,
    } = await import("./services/payment-idempotency.service.js");

    const rawIdem =
      req.headers["idempotency-key"] ?? req.headers["Idempotency-Key"];
    const idemKey = normalizeIdempotencyKey(
      Array.isArray(rawIdem) ? rawIdem[0] : rawIdem
    );
    if (rawIdem != null && rawIdem !== "" && !idemKey) {
      return res.status(400).json({
        message: "Idempotency-Key inválida (use 1–128 chars: A-Z a-z 0-9 . _ : -)",
        code: "INVALID_IDEMPOTENCY_KEY",
      });
    }

    const customerForFp = {
      name: customer.name,
      email: customer.email,
      cpf: customer.cpf ?? "",
      phone: customer.phone ?? "",
    };
    const fingerprint = fingerprintTicketCreatePayload({
      items: items.map((i) => ({
        ticketId: i.ticketId,
        quantity: Math.floor(i.quantity),
      })),
      customer: customerForFp,
    });

    if (idemKey) {
      const lookup = lookupIdempotentPayment(idemKey, fingerprint);
      if (lookup.kind === "hit") {
        logger.info("[tickets/create] Resposta idempotente reutilizada", {
          idempotencyKey: idemKey,
          transactionId: lookup.record.transactionId,
        });
        res.setHeader("Idempotent-Replay", "true");
        return res.status(lookup.record.statusCode).json(lookup.record.body);
      }
      if (lookup.kind === "conflict") {
        return res.status(409).json({
          message: "Idempotency-Key já usada com payload diferente",
          code: "IDEMPOTENCY_KEY_REUSE",
        });
      }
    }

    try {
      const lineItems = items.map((i) => ({ ticketId: i.ticketId, quantity: Math.floor(i.quantity) }));

      // Garante retenção atômica antes de criar o Pix
      let activeHoldId = typeof holdId === "string" ? holdId : "";
      if (activeHoldId) {
        const existing = getHold(activeHoldId);
        if (!existing || (existing.status !== "ACTIVE" && existing.status !== "ATTACHED")) {
          return res.status(409).json({
            message: "Sua reserva temporária expirou. Selecione os ingressos novamente.",
            code: "HOLD_EXPIRED",
          });
        }
      } else {
        const sid = typeof sessionId === "string" && sessionId ? sessionId : randomUUID();
        try {
          const hold = acquireHold(sid, lineItems);
          activeHoldId = hold.holdId;
        } catch (holdErr) {
          if (holdErr instanceof InsufficientInventoryError) {
            return res.status(409).json({
              message: holdErr.message,
              ticketId: holdErr.ticketId,
              available: holdErr.available,
              code: "INSUFFICIENT_INVENTORY",
            });
          }
          throw holdErr;
        }
      }

      const result = await createTicketPix(lineItems, customer);
      try {
        attachHoldToTransaction(activeHoldId, result.transactionId, result.expirationDate, lineItems);
      } catch (attachErr) {
        logger.error("[tickets/create] Falha ao vincular hold", {
          holdId: activeHoldId,
          error: attachErr instanceof Error ? attachErr.message : String(attachErr),
        });
        return res.status(409).json({
          message: "Não foi possível confirmar a retenção dos ingressos. Tente novamente.",
          code: "HOLD_ATTACH_FAILED",
        });
      }

      const voucherId = randomUUID();
      const voucherToken = signVoucherId(voucherId);
      ticketTransactions.set(result.transactionId, {
        ...result,
        createdAt: new Date().toISOString(),
        voucherId,
        voucherToken,
      });
      logger.info("[tickets/create] Cobrança criada", {
        orderId: result.transactionId,
        isCombo: result.isCombo,
        totalAmount: result.totalAmount,
        demo: result.demo,
        voucherId,
        holdId: activeHoldId,
        idempotencyKey: idemKey ?? undefined,
      });
      if (result.demo) {
        demoAutoConfirmCallbacks.set(result.transactionId, () => {
          const txn = ticketTransactions.get(result.transactionId);
          if (txn && txn.status === "PENDING") {
            txn.status = "APPROVED";
            consumeHoldByTransaction(result.transactionId);
          }
        });
      }
      const responseBody = {
        transactionId: result.transactionId,
        status: result.status,
        qrCodeBase64: result.qrCodeBase64,
        copyPasteCode: result.copyPasteCode,
        expirationDate: result.expirationDate,
        totalAmount: result.totalAmount,
        originalTotal: result.originalTotal,
        totalSavings: result.totalSavings,
        isCombo: result.isCombo,
        items: result.items,
        customer: result.customer,
        demo: result.demo,
        voucherId,
        voucherToken,
        holdId: activeHoldId,
      };
      if (idemKey) {
        storeIdempotentPayment(idemKey, fingerprint, 201, responseBody, result.transactionId);
      }
      return res.status(201).json(responseBody);
    } catch (err) {
      if (err instanceof UnknownTicketError) {
        return res.status(422).json({ message: err.message });
      }
      logger.error("[tickets/create] Erro ao criar cobrança", { error: err instanceof Error ? err.message : String(err) });
      return res.status(500).json({ message: "Erro ao criar cobrança Pix" });
    }
  });

  app.get("/api/payments/tickets/:id/status", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) {
      return res.status(404).json({ message: "Transação não encontrada" });
    }
    try {
      if (txn.demo) {
        const expiredMs = new Date(txn.expirationDate).getTime();
        if (Date.now() > expiredMs) {
          if (txn.status === "PENDING") {
            txn.status = "EXPIRED";
            releaseHoldByTransaction(id);
          }
          return res.json({ status: "EXPIRED", paid: false });
        }
        if (txn.status === "APPROVED") {
          consumeHoldByTransaction(id);
        }
        return res.json({ status: txn.status, paid: txn.status === "APPROVED" });
      }
      const { status, paid } = await checkTicketPaymentStatus(id);
      const prev = txn.status;
      txn.status = status;
      if (status === "APPROVED" && prev !== "APPROVED") {
        consumeHoldByTransaction(id);
      } else if ((status === "EXPIRED" || status === "CANCELLED" || status === "FAILED") && prev === "PENDING") {
        releaseHoldByTransaction(id);
      }
      return res.json({ status, paid });
    } catch (err) {
      logger.error("[tickets/status] Erro ao consultar status", { orderId: id, error: err instanceof Error ? err.message : String(err) });
      return res.status(500).json({ message: "Erro ao consultar status" });
    }
  });

  app.get("/api/payments/tickets/:id", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Transação não encontrada" });
    const { slimPaymentDetails } = await import("./services/bff/order-bff.service.js");
    // Fase 11: QR omitido por padrão (payload pesado); ?includeQr=1 restaura
    const includeQr =
      req.query.includeQr === "1" ||
      req.query.includeQr === "true";
    return res.json(slimPaymentDetails(txn, { includeQr }));
  });

  /** Fase 11 — BFF: pedido + status + Pix num único payload otimizado */
  app.get("/api/bff/orders/:id", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Pedido não encontrado" });

    const {
      buildOrderBffFull,
      buildOrderBffLite,
    } = await import("./services/bff/order-bff.service.js");

    const view = String(req.query.view ?? "full").toLowerCase() === "lite" ? "lite" : "full";

    // Atualiza status via provider quando não-demo (mesmo fluxo do /status)
    try {
      if (!txn.demo) {
        const { status, paid } = await checkTicketPaymentStatus(id);
        const prev = txn.status;
        txn.status = status;
        if (status === "APPROVED" && prev !== "APPROVED") {
          consumeHoldByTransaction(id);
        } else if (
          (status === "EXPIRED" || status === "CANCELLED" || status === "FAILED") &&
          prev === "PENDING"
        ) {
          releaseHoldByTransaction(id);
        }
        void paid;
      } else {
        const expiredMs = new Date(txn.expirationDate).getTime();
        if (Date.now() > expiredMs && txn.status === "PENDING") {
          txn.status = "EXPIRED";
          releaseHoldByTransaction(id);
        }
      }
    } catch (err) {
      logger.error("[bff/orders] Falha ao sincronizar status", {
        orderId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (view === "lite") {
      res.setHeader("Cache-Control", "private, max-age=5");
      return res.json(buildOrderBffLite(txn));
    }

    const includeQr =
      req.query.includeQr !== "0" && req.query.includeQr !== "false";
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(buildOrderBffFull(txn, { includeQr }));
  });

  app.post("/api/payments/tickets/:id/cancel", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Transação não encontrada" });
    if (txn.status !== "PENDING") {
      return res.status(400).json({ message: `Não é possível cancelar transação com status ${txn.status}` });
    }
    try {
      const { cancelled } = await cancelTicketPix(id);
      if (cancelled) {
        txn.status = "CANCELLED";
        releaseHoldByTransaction(id);
      }
      return res.json({ cancelled, status: txn.status });
    } catch (err) {
      logger.error("[tickets/cancel] Erro ao cancelar cobrança", { orderId: id, error: err instanceof Error ? err.message : String(err) });
      return res.status(500).json({ message: "Erro ao cancelar cobrança" });
    }
  });

  app.post("/api/payments/tickets/:id/demo-confirm", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Transação não encontrada" });
    if (!txn.demo) return res.status(400).json({ message: "Apenas para modo demo" });
    if (txn.status !== "PENDING") return res.status(400).json({ message: "Transação não está pendente" });
    txn.status = "APPROVED";
    consumeHoldByTransaction(id);
    const cb = demoAutoConfirmCallbacks.get(id);
    if (cb) { cb(); demoAutoConfirmCallbacks.delete(id); }

    import("./services/post-payment-orchestrator.service.js").then(({ runPostPaymentOrchestration }) => {
      runPostPaymentOrchestration({
        orderId: txn.transactionId,
        customerName: txn.customer.name,
        customerEmail: txn.customer.email,
        customerPhone: txn.customer.phone,
        totalAmount: txn.totalAmount,
        originalTotal: txn.originalTotal,
        totalSavings: txn.totalSavings,
        isCombo: txn.isCombo,
        status: txn.status,
        createdAt: txn.createdAt,
        expirationDate: txn.expirationDate,
        demo: txn.demo,
        copyPasteCode: txn.copyPasteCode,
        items: txn.items,
      }).catch((err: unknown) => {
        console.warn("[demo-confirm] orchestrator error:", err instanceof Error ? err.message : err);
      });
    }).catch(() => {});

    return res.json({ status: "APPROVED", paid: true });
  });

  app.post("/api/webhooks/tickets", pixWebhookRateLimit, async (req: Request, res: Response) => {
    const apiKey = req.headers["x-api-key"] as string | undefined;
    if (process.env.WEBHOOK_SECRET && apiKey !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { transactionId, status, eventId } = req.body as {
      transactionId?: string
      status?: string
      eventId?: string
    };
    if (!transactionId || !status) {
      return res.status(400).json({ message: "transactionId e status são obrigatórios" });
    }

    const { buildWebhookEventKey, claimWebhookEvent } = await import(
      "./services/webhook-idempotency.service.js"
    );
    const eventKey = buildWebhookEventKey({ eventId, transactionId, status });
    const claim = claimWebhookEvent(eventKey);
    if (!claim.isNew) {
      logger.info("[webhooks/tickets] Evento duplicado ignorado", {
        eventKey,
        transactionId,
        status,
      });
      return res.status(200).json({ received: true, duplicate: true, eventKey });
    }

    const txn = ticketTransactions.get(transactionId);
    if (txn) {
      const map: Record<string, "PENDING" | "APPROVED" | "EXPIRED" | "FAILED" | "CANCELLED"> = {
        paid: "APPROVED", approved: "APPROVED", expired: "EXPIRED",
        failed: "FAILED", cancelled: "CANCELLED",
      };
      const prevStatus = txn.status;
      txn.status = map[status.toLowerCase()] ?? txn.status;

      if (prevStatus !== "APPROVED" && txn.status === "APPROVED") {
        consumeHoldByTransaction(transactionId);
      } else if (
        prevStatus === "PENDING" &&
        (txn.status === "EXPIRED" || txn.status === "FAILED" || txn.status === "CANCELLED")
      ) {
        releaseHoldByTransaction(transactionId);
      }

      if (prevStatus !== "APPROVED" && txn.status === "APPROVED") {
        import("./services/post-payment-orchestrator.service.js").then(({ runPostPaymentOrchestration }) => {
          runPostPaymentOrchestration({
            orderId: txn.transactionId,
            customerName: txn.customer.name,
            customerEmail: txn.customer.email,
            customerPhone: txn.customer.phone,
            totalAmount: txn.totalAmount,
            originalTotal: txn.originalTotal,
            totalSavings: txn.totalSavings,
            isCombo: txn.isCombo,
            status: txn.status,
            createdAt: txn.createdAt,
            expirationDate: txn.expirationDate,
            demo: txn.demo,
            copyPasteCode: txn.copyPasteCode,
            items: txn.items,
          }).catch((err: unknown) => {
            console.warn("[webhook] orchestrator error:", err instanceof Error ? err.message : err);
          });
        }).catch(() => {});
      }
    }
    return res.status(200).json({ received: true, duplicate: false, eventKey });
  });

  // ─── ORDERS / VOUCHER ──────────────────────────────────────────────────────

  app.get("/api/orders/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Pedido não encontrado" });
    return res.json({
      orderId: txn.transactionId,
      status: txn.status,
      totalAmount: txn.totalAmount,
      originalTotal: txn.originalTotal,
      totalSavings: txn.totalSavings,
      isCombo: txn.isCombo,
      items: txn.items,
      customer: {
        name: txn.customer.name,
        email: txn.customer.email,
        phone: txn.customer.phone,
        cpf: txn.customer.cpf,
      },
      createdAt: txn.createdAt,
      expirationDate: txn.expirationDate,
      demo: txn.demo,
    });
  });

  app.get("/api/orders/:id/tickets", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Pedido não encontrado" });
    return res.json({
      orderId: txn.transactionId,
      items: txn.items.map((i) => ({
        ticketId: i.ticketId,
        title: i.title,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.unitPrice * i.quantity,
      })),
    });
  });

  app.get("/api/orders/:id/voucher", voucherRateLimit, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);
    if (!txn) return res.status(404).json({ message: "Pedido não encontrado" });

    const token = req.query.token as string | undefined;
    const isAdminSession = req.session.userId
      ? await storage.getUser(req.session.userId).then((u) => u?.role === "admin").catch(() => false)
      : false;

    if (token) {
      if (!verifyVoucherToken(txn.voucherId, token)) {
        logger.warn("[voucher] Token inválido na tentativa de download", { orderId: id, ip: req.ip });
        return res.status(403).json({ message: "Token de voucher inválido." });
      }
      logger.info("[voucher] Download autorizado via token HMAC", { orderId: id });
    } else if (isAdminSession) {
      logger.info("[voucher] Download autorizado via sessão admin", { orderId: id, adminId: req.session.userId });
    } else {
      logger.warn("[voucher] Tentativa de download sem token e sem sessão admin", { orderId: id, ip: req.ip });
      return res.status(401).json({ message: "Token de voucher obrigatório. Utilize o link enviado por e-mail ou WhatsApp." });
    }

    try {
      const { generateVoucherPdf } = await import("./services/voucher-pdf.service");
      const pdfBuffer = await generateVoucherPdf({
        orderId: txn.transactionId,
        customerName: txn.customer.name,
        customerEmail: txn.customer.email,
        items: txn.items.map((i) => ({
          ticketId: i.ticketId,
          title: i.title,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        totalAmount: txn.totalAmount,
        originalTotal: txn.originalTotal,
        totalSavings: txn.totalSavings,
        isCombo: txn.isCombo,
        status: txn.status,
        createdAt: txn.createdAt,
        expirationDate: txn.expirationDate,
        demo: txn.demo,
        copyPasteCode: txn.copyPasteCode,
      });
      const safeId = id.slice(0, 32).replace(/[^a-zA-Z0-9\-_]/g, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="ingresso-rsv360-${safeId}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("Cache-Control", "no-store");
      return res.end(pdfBuffer);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error("[orders/voucher] Falha ao gerar voucher PDF", { orderId: id, error: errMsg });
      raiseAlert("VOUCHER_PDF_FAILURE", `Falha ao gerar voucher para orderId=${id}`, {
        severity: "critical",
        orderId: id,
        meta: { error: errMsg },
      });
      return res.status(500).json({ message: "Erro ao gerar voucher PDF" });
    }
  });

  // ─── RECOMMENDATIONS (Combo IA) ────────────────────────────────────────────

  const { getRecommendations, getSessionRecommendations } = await import("./services/recommendation.service");

  const CATALOG_TICKETS_SNAPSHOT = [
    { id: "hot-park", name: "Ingresso Hot Park — Adulto", unitPrice: 189, originalPrice: 220, discount: 14, category: "parques", tags: ["família", "aventura", "águas termais"] },
    { id: "hot-park-crianca", name: "Ingresso Hot Park — Criança", unitPrice: 99, originalPrice: 130, discount: 24, category: "parques", tags: ["criança", "família", "kids"] },
    { id: "ingresso-vip", name: "Ingresso VIP — Acesso Prioritário", unitPrice: 320, originalPrice: 380, discount: 16, category: "parques", tags: ["vip", "premium", "exclusivo"] },
    { id: "ingresso-noturno", name: "Ingresso Noturno — Sunset Edition", unitPrice: 150, originalPrice: 190, discount: 21, category: "parques", tags: ["noturno", "casal", "adulto"] },
    { id: "diroma-acqua-park", name: "Ingresso diRoma Acqua Park", unitPrice: 90, originalPrice: 110, discount: 18, category: "parques", tags: ["família", "diversão", "ondas"] },
    { id: "lagoa-termas", name: "Ingresso Lagoa Termas Parque", unitPrice: 75, originalPrice: 95, discount: 21, category: "natureza", tags: ["relaxamento", "natureza", "casal"] },
    { id: "passaporte-kawana", name: "Passaporte Kawana (3 dias)", unitPrice: 210, originalPrice: 265, discount: 21, category: "parques", tags: ["família", "multidia", "águas termais"] },
    { id: "water-park", name: "Combo Hot Park + diRoma Acqua", unitPrice: 245, originalPrice: 299, discount: 18, category: "combos", tags: ["combo", "família", "aventura"], popular: true },
    { id: "kawana-park", name: "Combo Família (2 Adultos + 1 Criança)", unitPrice: 380, originalPrice: 450, discount: 16, category: "combos", tags: ["família", "combo", "crianças"] },
    { id: "combo-3-parques", name: "Combo 3 Parques — Semana Completa", unitPrice: 320, originalPrice: 395, discount: 19, category: "combos", tags: ["combo", "família", "melhor valor"], popular: true },
    { id: "transp-goiania", name: "Transporte Goiânia → Caldas Novas", unitPrice: 65, originalPrice: 90, discount: 28, category: "transporte", tags: ["transporte", "conforto", "família"] },
    { id: "transp-brasilia", name: "Transporte Brasília → Caldas Novas", unitPrice: 85, originalPrice: 120, discount: 29, category: "transporte", tags: ["transporte", "conforto", "família"] },
    { id: "cabana-standard", name: "Cabana Standard — até 4 pessoas", unitPrice: 280, originalPrice: 350, discount: 20, category: "cabanas", tags: ["cabana", "família", "conforto"] },
    { id: "cabana-premium", name: "Cabana Premium — até 6 pessoas", unitPrice: 450, originalPrice: 560, discount: 20, category: "cabanas", tags: ["cabana", "grupo", "premium"], popular: true },
    { id: "ingresso-open-hotel", name: "Open Parques + Hotel (1 Noite)", unitPrice: 540, originalPrice: 680, discount: 21, category: "combos", tags: ["hotel", "completo", "premium"] },
  ];

  const { z: comboZ } = await import("zod");
  const comboRequestSchema = comboZ.object({
    cartItems: comboZ.array(
      comboZ.object({
        ticketId: comboZ.string().min(1),
        name: comboZ.string(),
        unitPrice: comboZ.number().positive(),
        originalPrice: comboZ.number().optional(),
        discount: comboZ.number().optional(),
        quantity: comboZ.number().int().positive(),
        category: comboZ.string().optional(),
        tags: comboZ.array(comboZ.string()).optional(),
      })
    ).min(1),
    sessionId: comboZ.string().optional(),
    maxSuggestions: comboZ.number().int().min(1).max(5).optional(),
  });

  app.post("/api/recommendations/combo", recommendationsRateLimit, (req: Request, res: Response) => {
    const parsed = comboRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Payload inválido", errors: parsed.error.issues });
    }
    const { cartItems, sessionId, maxSuggestions } = parsed.data;
    const result = getRecommendations({
      cartItems,
      catalog: CATALOG_TICKETS_SNAPSHOT,
      sessionId,
      maxSuggestions,
      comboDiscountRate: 0.15,
    });
    return res.json(result);
  });

  app.get("/api/recommendations/cart/:sessionId", (req: Request, res: Response) => {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    if (!sessionId) return res.status(400).json({ message: "sessionId obrigatório" });
    const result = getSessionRecommendations(sessionId);
    if (!result) {
      return res.status(404).json({ message: "Sessão não encontrada ou expirada", sessionId });
    }
    return res.json(result);
  });

  // ─── ADMIN METRICS ───────────────────────────────────────────────────────

  app.get("/api/admin/metrics", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Acesso restrito a administradores" });

    const allTxns = Array.from(ticketTransactions.values());
    const total = allTxns.length;
    const approved = allTxns.filter((t) => t.status === "APPROVED");
    const combos = allTxns.filter((t) => t.isCombo);
    const combosApproved = approved.filter((t) => t.isCombo);
    const nonCombosApproved = approved.filter((t) => !t.isCombo);

    const avgTicketCombo = combosApproved.length > 0
      ? Math.round(combosApproved.reduce((s, t) => s + t.totalAmount, 0) / combosApproved.length)
      : 0;
    const avgTicketNoCombo = nonCombosApproved.length > 0
      ? Math.round(nonCombosApproved.reduce((s, t) => s + t.totalAmount, 0) / nonCombosApproved.length)
      : 0;

    const monthlyRevenue = approved.reduce((s, t) => s + t.totalAmount, 0);
    const totalSavings = approved.reduce((s, t) => s + t.totalSavings, 0);

    const { getPendingDeliveries } = await import("./services/retry-queue.service.js");
    const pendingDeliveries = getPendingDeliveries();

    const hotelGroupCounts: Record<string, { suggested: number; accepted: number }> = {};
    for (const txn of allTxns) {
      const { TICKET_GROUP_MAP } = await import("@shared/catalog-groups");
      for (const item of txn.items) {
        const group = TICKET_GROUP_MAP[item.ticketId] ?? "INDEPENDENTE";
        if (!hotelGroupCounts[group]) hotelGroupCounts[group] = { suggested: 0, accepted: 0 };
        hotelGroupCounts[group].suggested++;
        if (txn.status === "APPROVED") hotelGroupCounts[group].accepted++;
      }
    }

    const topHotelGroups = Object.entries(hotelGroupCounts)
      .map(([group, counts]) => ({
        group,
        suggested: counts.suggested,
        accepted: counts.accepted,
        acceptanceRate: counts.suggested > 0 ? Math.round((counts.accepted / counts.suggested) * 100) : 0,
      }))
      .sort((a, b) => b.accepted - a.accepted)
      .slice(0, 5);

    return res.json({
      summary: {
        totalOrders: total,
        paidOrders: approved.length,
        conversionRate: total > 0 ? Math.round((approved.length / total) * 100) : 0,
        comboRate: total > 0 ? Math.round((combos.length / total) * 100) : 0,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        totalSavings: Math.round(totalSavings * 100) / 100,
        avgTicketCombo,
        avgTicketNoCombo,
        vouchersGenerated: approved.length,
        vouchersPending: pendingDeliveries.length,
      },
      topHotelGroups,
      pendingDeliveries: pendingDeliveries.slice(0, 20),
    });
  });

  app.post("/api/admin/orders/:id/resend", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Acesso restrito a administradores" });

    const orderId = String(req.params.id);
    const txn = ticketTransactions.get(orderId);
    if (!txn) return res.status(404).json({ message: "Pedido não encontrado" });
    if (txn.status !== "APPROVED") {
      return res.status(400).json({ message: "Reenvio só disponível para pedidos com status APPROVED" });
    }

    try {
      const { retryDelivery } = await import("./services/voucher-delivery.service.js");
      const result = await retryDelivery({
        orderId: txn.transactionId,
        customerName: txn.customer.name,
        customerEmail: txn.customer.email,
        customerPhone: txn.customer.phone,
        totalAmount: txn.totalAmount,
      });
      return res.json({
        orderId,
        allDelivered: result.allDelivered,
        pendingChannels: result.pendingChannels,
        whatsapp: result.whatsapp,
        email: result.email,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      return res.status(500).json({ message: `Falha no reenvio: ${msg}` });
    }
  });

  // ─── ADMIN ALERTS ────────────────────────────────────────────────────────

  app.get("/api/admin/alerts", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Acesso restrito a administradores" });
    return res.json({ alerts: getActiveAlerts() });
  });

  app.post("/api/admin/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Acesso restrito a administradores" });
    const alertId = String(req.params.alertId);
    const ok = acknowledgeAlert(alertId);
    if (!ok) return res.status(404).json({ message: "Alerta não encontrado" });
    return res.json({ ok: true, alertId });
  });

  // ─── V1 RECOMMENDATIONS ──────────────────────────────────────────────────

  app.get("/api/v1/recommendations", recommendationsRateLimit, (req: Request, res: Response) => {
    const { ticketIds, profile, limit: limitStr } = req.query as Record<string, string>;
    const ids = ticketIds ? ticketIds.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const parsedLimit = limitStr !== undefined ? parseInt(limitStr, 10) : 5;
    if (limitStr !== undefined && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 10)) {
      return res.status(400).json({ message: "Parâmetro 'limit' deve ser um inteiro entre 1 e 10" });
    }
    const maxSuggestions = parsedLimit;
    const cartItems = ids.map((id) => {
      const found = CATALOG_TICKETS_SNAPSHOT.find((t) => t.id === id);
      return {
        ticketId: id,
        name: found?.name ?? id,
        unitPrice: found?.unitPrice ?? 0,
        originalPrice: found?.originalPrice,
        discount: found?.discount,
        quantity: 1,
        category: found?.category,
        tags: found?.tags,
      };
    });
    const result = getRecommendations({
      cartItems,
      catalog: CATALOG_TICKETS_SNAPSHOT,
      sessionId: profile,
      maxSuggestions,
      comboDiscountRate: 0.15,
    });
    return res.json(result);
  });

  app.post("/api/v1/recommendations/sync", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Acesso restrito a administradores" });

    const dryRun = req.body?.dryRun === true;

    try {
      const { runCatalogSync } = await import("./services/catalog-sync.service.js");
      const result = await runCatalogSync({ dryRun });
      return res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      return res.status(500).json({ message: `Falha na sincronização: ${msg}` });
    }
  });

  return httpServer;
}
