import type { Express, Request, Response, RequestHandler } from "express";
import { randomUUID } from "crypto";

import { logger } from "../lib/logger.js";
import {
  createTicketPix,
  checkTicketPaymentStatus,
  cancelTicketPix,
  demoAutoConfirmCallbacks,
  UnknownTicketError,
} from "../services/ticket-payment.service";

export type TicketTransactionRecord = {
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
};

export const ticketTransactions = new Map<string, TicketTransactionRecord>();

type RegisterTicketRoutesDeps = {
  pixWebhookRateLimit: RequestHandler;
  signVoucherId: (voucherId: string) => string;
};

export function registerTicketRoutes(
  app: Express,
  deps: RegisterTicketRoutesDeps
) {
  const { pixWebhookRateLimit, signVoucherId } = deps;

  app.post("/api/payments/tickets/create", async (req: Request, res: Response) => {
    const { items, customer } = req.body as {
      items?: Array<{ ticketId?: string; quantity?: number }>;
      customer?: { name?: string; email?: string; cpf?: string; phone?: string };
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items é obrigatório" });
    }

    const invalidItems = items.filter(
      (i) =>
        typeof i.ticketId !== "string" ||
        !i.ticketId ||
        typeof i.quantity !== "number" ||
        i.quantity < 1
    );

    if (invalidItems.length > 0) {
      return res
        .status(400)
        .json({ message: "Cada item deve ter ticketId e quantity válidos" });
    }

    if (!customer?.name || !customer?.email || !customer?.cpf || !customer?.phone) {
      return res
        .status(400)
        .json({ message: "Dados do cliente são obrigatórios" });
    }

    const {
      normalizeIdempotencyKey,
      fingerprintTicketCreatePayload,
      lookupIdempotentPayment,
      storeIdempotentPayment,
    } = await import("../services/payment-idempotency.service.js");

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

    const fingerprint = fingerprintTicketCreatePayload({
      items: items.map((i) => ({
        ticketId: i.ticketId as string,
        quantity: Math.floor(i.quantity as number),
      })),
      customer: {
        name: customer.name,
        email: customer.email,
        cpf: customer.cpf,
        phone: customer.phone,
      },
    });

    if (idemKey) {
      const lookup = lookupIdempotentPayment(idemKey, fingerprint);
      if (lookup.kind === "hit") {
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
      const lineItems = items.map((i) => ({
        ticketId: i.ticketId as string,
        quantity: Math.floor(i.quantity as number),
      }));

      const result = await createTicketPix(lineItems, {
        name: customer.name,
        email: customer.email,
        cpf: customer.cpf,
        phone: customer.phone,
      });

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
        idempotencyKey: idemKey ?? undefined,
      });

      if (result.demo) {
        demoAutoConfirmCallbacks.set(result.transactionId, () => {
          const txn = ticketTransactions.get(result.transactionId);
          if (txn && txn.status === "PENDING") txn.status = "APPROVED";
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
      };
      if (idemKey) {
        storeIdempotentPayment(idemKey, fingerprint, 201, responseBody, result.transactionId);
      }
      return res.status(201).json(responseBody);
    } catch (err) {
      if (err instanceof UnknownTicketError) {
        return res.status(422).json({ message: err.message });
      }

      logger.error("[tickets/create] Erro ao criar cobrança", {
        error: err instanceof Error ? err.message : String(err),
      });

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
          txn.status = "EXPIRED";
          return res.json({ status: "EXPIRED", paid: false });
        }

        return res.json({ status: txn.status, paid: false });
      }

      const { status, paid } = await checkTicketPaymentStatus(id);
      txn.status = status;

      return res.json({ status, paid });
    } catch (err) {
      logger.error("[tickets/status] Erro ao consultar status", {
        orderId: id,
        error: err instanceof Error ? err.message : String(err),
      });

      return res.status(500).json({ message: "Erro ao consultar status" });
    }
  });

  app.get("/api/payments/tickets/:id", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);

    if (!txn) {
      return res.status(404).json({ message: "Transação não encontrada" });
    }

    return res.json(txn);
  });

  app.post("/api/payments/tickets/:id/cancel", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);

    if (!txn) {
      return res.status(404).json({ message: "Transação não encontrada" });
    }

    if (txn.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: `Não é possível cancelar transação com status ${txn.status}` });
    }

    try {
      const { cancelled } = await cancelTicketPix(id);

      if (cancelled) {
        txn.status = "CANCELLED";
      }

      return res.json({ cancelled, status: txn.status });
    } catch (err) {
      logger.error("[tickets/cancel] Erro ao cancelar cobrança", {
        orderId: id,
        error: err instanceof Error ? err.message : String(err),
      });

      return res.status(500).json({ message: "Erro ao cancelar cobrança" });
    }
  });

  app.post("/api/payments/tickets/:id/demo-confirm", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const txn = ticketTransactions.get(id);

    if (!txn) {
      return res.status(404).json({ message: "Transação não encontrada" });
    }

    if (!txn.demo) {
      return res.status(400).json({ message: "Apenas para modo demo" });
    }

    if (txn.status !== "PENDING") {
      return res.status(400).json({ message: "Transação não está pendente" });
    }

    txn.status = "APPROVED";

    const cb = demoAutoConfirmCallbacks.get(id);
    if (cb) {
      cb();
      demoAutoConfirmCallbacks.delete(id);
    }

    import("../services/post-payment-orchestrator.service.js")
      .then(({ runPostPaymentOrchestration }) => {
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
          console.warn(
            "[demo-confirm] orchestrator error:",
            err instanceof Error ? err.message : err
          );
        });
      })
      .catch(() => {});

    return res.json({ status: "APPROVED", paid: true });
  });

  app.post("/api/webhooks/tickets", pixWebhookRateLimit, async (req: Request, res: Response) => {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (process.env.WEBHOOK_SECRET && apiKey !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { transactionId, status, eventId } = req.body as {
      transactionId?: string;
      status?: string;
      eventId?: string;
    };

    if (!transactionId || !status) {
      return res
        .status(400)
        .json({ message: "transactionId e status são obrigatórios" });
    }

    const { buildWebhookEventKey, claimWebhookEvent } = await import(
      "../services/webhook-idempotency.service.js"
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
      const map: Record<
        string,
        "PENDING" | "APPROVED" | "EXPIRED" | "FAILED" | "CANCELLED"
      > = {
        paid: "APPROVED",
        approved: "APPROVED",
        expired: "EXPIRED",
        failed: "FAILED",
        cancelled: "CANCELLED",
      };

      const prevStatus = txn.status;
      txn.status = map[status.toLowerCase()] ?? txn.status;

      if (prevStatus !== "APPROVED" && txn.status === "APPROVED") {
        import("../services/post-payment-orchestrator.service.js")
          .then(({ runPostPaymentOrchestration }) => {
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
              console.warn(
                "[webhook] orchestrator error:",
                err instanceof Error ? err.message : err
              );
            });
          })
          .catch(() => {});
      }
    }

    return res.status(200).json({ received: true, duplicate: false, eventKey });
  });
}