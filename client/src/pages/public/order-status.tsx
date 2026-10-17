import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Ticket,
  XCircle,
} from "lucide-react";
import {
  OrderSummaryCard,
  type OrderSummaryData,
} from "@/components/success/OrderSummaryCard";
import { VoucherDownloadCard } from "@/components/success/VoucherDownloadCard";
import { PixQrCodePanel } from "@/components/checkout/PixQrCodePanel";
import { PixCopyPasteField } from "@/components/checkout/PixCopyPasteField";
import { PixCountdown } from "@/components/checkout/PixCountdown";
import { PaymentStatusBanner } from "@/components/checkout/PaymentStatusBanner";
import { trackEvent } from "@/lib/analytics";

type PaymentStatus =
  | "PENDING"
  | "APPROVED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED";

interface TicketPaymentDetails {
  transactionId: string;
  status: PaymentStatus;
  qrCodeBase64: string;
  copyPasteCode: string;
  expirationDate: string;
  totalAmount: number;
  originalTotal: number;
  totalSavings: number;
  isCombo: boolean;
  items: Array<{
    ticketId: string;
    title: string;
    quantity: number;
    unitPrice: number;
  }>;
  demo: boolean;
  voucherId?: string;
  voucherToken?: string;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getOrderIdFromPath(pathname: string) {
  const cleanPath = pathname.split("?")[0];
  const parts = cleanPath.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? "");
}

function normalizeStatus(value?: string): PaymentStatus {
  const normalized = String(value ?? "PENDING").toUpperCase();

  if (
    normalized === "APPROVED" ||
    normalized === "EXPIRED" ||
    normalized === "FAILED" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }

  return "PENDING";
}

const SUPPORT_WHATSAPP_NUMBER = "5562999999999";

function getSupportMessage(status: PaymentStatus, orderId: string) {
  const safeOrderId = orderId || "sem-id";

  if (status === "PENDING") {
    return `Olá! Preciso de ajuda para concluir o pagamento do pedido ${safeOrderId}.`;
  }

  if (status === "FAILED") {
    return `Olá! Meu pagamento falhou e quero tentar novamente no pedido ${safeOrderId}.`;
  }

  if (status === "EXPIRED") {
    return `Olá! Meu pedido expirou e quero ajuda para gerar um novo pedido. Pedido: ${safeOrderId}.`;
  }

  if (status === "APPROVED") {
    return `Olá! Tenho uma dúvida sobre o voucher do pedido ${safeOrderId}.`;
  }

  return `Olá! Preciso de atendimento sobre o pedido ${safeOrderId}.`;
}

export default function OrderStatusPage() {
  const [location] = useLocation();

  const orderId = useMemo(() => getOrderIdFromPath(location), [location]);

  const voucherToken = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const token = new URLSearchParams(window.location.search).get("token");
    return token ?? undefined;
  }, [location]);

  const [order, setOrder] = useState<OrderSummaryData | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<TicketPaymentDetails | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("PENDING");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  async function loadOrder(showLoading = true) {
    if (!orderId) {
      setErrorMsg("Pedido inválido.");
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setErrorMsg("");

      // Fase 11 — BFF: 1 request no lugar de orders + status + payment details
      const bffRes = await fetch(
        `/api/bff/orders/${encodeURIComponent(orderId)}?view=full`,
      );
      if (!bffRes.ok) {
        const body = (await bffRes.json().catch(() => ({}))) as {
          message?: string;
        };
        trackEvent("order_bff_error", {
          orderId,
          status: bffRes.status,
          message: body.message,
        });
        throw new Error(body.message ?? "Pedido não encontrado.");
      }

      const bff = (await bffRes.json()) as {
        orderId: string;
        status: string;
        paid: boolean;
        totalAmount: number;
        originalTotal: number;
        totalSavings: number;
        isCombo: boolean;
        items: Array<{
          ticketId: string;
          title: string;
          quantity: number;
          unitPrice: number;
        }>;
        customer: { name: string; email: string; phone?: string };
        createdAt: string;
        expirationDate: string;
        secondsLeft: number;
        demo: boolean;
        voucherId?: string;
        pix: {
          copyPasteCode: string;
          qrCodeBase64?: string;
          hasQr: boolean;
        } | null;
      };

      const nextStatus = normalizeStatus(bff.status);
      const orderData: OrderSummaryData = {
        orderId: bff.orderId,
        status: nextStatus,
        totalAmount: bff.totalAmount,
        originalTotal: bff.originalTotal,
        totalSavings: bff.totalSavings,
        isCombo: bff.isCombo,
        items: bff.items,
        customer: { name: bff.customer.name, email: bff.customer.email },
        createdAt: bff.createdAt,
        expirationDate: bff.expirationDate,
        demo: bff.demo,
      };

      setOrder(orderData);
      setStatus(nextStatus);
      setSecondsLeft(bff.secondsLeft ?? 0);
      trackEvent("order_bff_load", {
        orderId: bff.orderId,
        status: nextStatus,
        view: "full",
        paid: bff.paid,
      });
      if (showLoading) {
        trackEvent("order_status_view", {
          orderId: bff.orderId,
          status: nextStatus,
        });
      }

      if (bff.pix) {
        setPaymentDetails({
          transactionId: bff.orderId,
          status: nextStatus,
          qrCodeBase64: bff.pix.qrCodeBase64 ?? "",
          copyPasteCode: bff.pix.copyPasteCode,
          expirationDate: bff.expirationDate,
          totalAmount: bff.totalAmount,
          originalTotal: bff.originalTotal,
          totalSavings: bff.totalSavings,
          isCombo: bff.isCombo,
          items: bff.items,
          demo: bff.demo,
          voucherId: bff.voucherId,
          voucherToken,
        });
      } else {
        setPaymentDetails({
          transactionId: bff.orderId,
          status: nextStatus,
          qrCodeBase64: "",
          copyPasteCode: "",
          expirationDate: bff.expirationDate,
          totalAmount: bff.totalAmount,
          originalTotal: bff.originalTotal,
          totalSavings: bff.totalSavings,
          isCombo: bff.isCombo,
          items: bff.items,
          demo: bff.demo,
          voucherId: bff.voucherId,
          voucherToken,
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar pedido.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    if (!orderId) return;

    try {
      setRefreshing(true);

      const statusRes = await fetch(
        `/api/bff/orders/${encodeURIComponent(orderId)}?view=lite`,
      );

      if (!statusRes.ok) return;

      const statusData = (await statusRes.json()) as {
        status?: string;
        paid?: boolean;
        secondsLeft?: number;
      };

      const nextStatus = normalizeStatus(statusData.status);
      setStatus(nextStatus);
      if (typeof statusData.secondsLeft === "number") {
        setSecondsLeft(statusData.secondsLeft);
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
            }
          : prev,
      );

      setPaymentDetails((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
            }
          : prev,
      );
    } finally {
      setRefreshing(false);
    }
  }

  const handleCopyOrderLink = async () => {
    try {
      const base =
        typeof window !== "undefined" ? window.location.origin : "";
      const token = voucherToken ?? paymentDetails?.voucherToken;
      const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
      const link = `${base}/pedido/${orderId}${suffix}`;

      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  };

  useEffect(() => {
    loadOrder(true);
  }, [orderId]);

  useEffect(() => {
    if (status !== "PENDING") return;

    const timer = window.setInterval(() => {
      refreshStatus();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [status, orderId]);

  useEffect(() => {
    if (!paymentDetails?.expirationDate) return;

    const updateSeconds = () => {
      const diffSec = Math.max(
        0,
        Math.floor(
          (new Date(paymentDetails.expirationDate).getTime() - Date.now()) / 1000,
        ),
      );
      setSecondsLeft(diffSec);
    };

    updateSeconds();

    if (status !== "PENDING") return;

    const timer = window.setInterval(updateSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [paymentDetails?.expirationDate, status]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const isExpired = secondsLeft === 0 && status === "PENDING";

  const statusConfig = {
    PENDING: {
      icon: <Clock3 style={{ width: 24, height: 24, color: "#D97706" }} />,
      title: "Aguardando pagamento",
      description:
        "Seu pedido foi criado e estamos aguardando a confirmação do pagamento.",
      bg: "#FFFBEB",
      border: "#FCD34D",
      text: "#92400E",
    },
    APPROVED: {
      icon: <CheckCircle2 style={{ width: 24, height: 24, color: "#16A34A" }} />,
      title: "Pagamento aprovado",
      description:
        "Pagamento confirmado com sucesso. Seu voucher já pode ser baixado.",
      bg: "#F0FDF4",
      border: "#86EFAC",
      text: "#166534",
    },
    EXPIRED: {
      icon: <AlertCircle style={{ width: 24, height: 24, color: "#DC2626" }} />,
      title: "Pagamento expirado",
      description:
        "O prazo do Pix expirou. Gere um novo pedido para concluir a compra.",
      bg: "#FEF2F2",
      border: "#FCA5A5",
      text: "#991B1B",
    },
    FAILED: {
      icon: <XCircle style={{ width: 24, height: 24, color: "#DC2626" }} />,
      title: "Falha no pagamento",
      description: "Não foi possível confirmar o pagamento deste pedido.",
      bg: "#FEF2F2",
      border: "#FCA5A5",
      text: "#991B1B",
    },
    CANCELLED: {
      icon: <XCircle style={{ width: 24, height: 24, color: "#6B7280" }} />,
      title: "Pedido cancelado",
      description: "Este pedido foi cancelado e não pode mais ser utilizado.",
      bg: "#F9FAFB",
      border: "#D1D5DB",
      text: "#374151",
    },
  } as const;

  const currentStatus = statusConfig[status];

  const whatsappHref = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    getSupportMessage(status, orderId),
  )}`;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8FAFC",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Loader2
            style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
            Carregando status do pedido...
          </span>
        </div>
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8FAFC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <AlertCircle style={{ width: 22, height: 22, color: "#DC2626" }} />
            <h1
              style={{
                fontSize: 20,
                lineHeight: 1.2,
                margin: 0,
                color: "#111827",
              }}
            >
              Não foi possível carregar o pedido
            </h1>
          </div>

          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 0 }}>
            {errorMsg || "Pedido não encontrado."}
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <button
              onClick={() => loadOrder(true)}
              style={{
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                background: "#2563EB",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>

            <a
              href="/ingressos"
              style={{
                textDecoration: "none",
                borderRadius: 10,
                padding: "10px 14px",
                background: "#E5E7EB",
                color: "#111827",
                fontWeight: 700,
              }}
            >
              Voltar para ingressos
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            background: currentStatus.bg,
            border: `1px solid ${currentStatus.border}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}
          data-testid="card-order-status"
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <div>{currentStatus.icon}</div>
              <div>
                <h1
                  style={{
                    fontSize: 22,
                    lineHeight: 1.2,
                    margin: "0 0 6px 0",
                    color: currentStatus.text,
                  }}
                >
                  {currentStatus.title}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: currentStatus.text,
                    opacity: 0.92,
                  }}
                >
                  {currentStatus.description}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleCopyOrderLink}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#fff",
                  color: "#111827",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                data-testid="button-copy-order-link"
              >
                <Copy style={{ width: 16, height: 16 }} />
                {linkCopied ? "Link copiado" : "Copiar link do pedido"}
              </button>

              {status === "PENDING" && (
                <button
                  onClick={refreshStatus}
                  disabled={refreshing}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#fff",
                    color: "#111827",
                    fontWeight: 700,
                    cursor: refreshing ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <RefreshCcw
                    style={{
                      width: 16,
                      height: 16,
                      animation: refreshing ? "spin 1s linear infinite" : "none",
                    }}
                  />
                  Atualizar status
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>Pedido</p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {order.orderId}
              </p>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
                Criado em
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {formatDate(order.createdAt)}
              </p>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
                Expiração
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {formatDate(paymentDetails?.expirationDate ?? order.expirationDate)}
              </p>
            </div>
          </div>
        </div>

        {status === "PENDING" && paymentDetails && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
            data-testid="card-pix-pending-status"
          >
            <PaymentStatusBanner status={status} isExpired={isExpired} />

            {paymentDetails.demo && (
              <div
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 10,
                  padding: "8px 12px",
                  marginBottom: 14,
                  fontSize: 12,
                  color: "#1D4ED8",
                }}
                data-testid="badge-demo-mode"
              >
                Modo demonstração — nenhum pagamento real será processado
              </div>
            )}

            {!isExpired && (
              <PixCountdown
                minutes={minutes}
                seconds={seconds}
                isExpired={isExpired}
              />
            )}

            <PixQrCodePanel qrCodeBase64={paymentDetails.qrCodeBase64} />

            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "#6B7280",
                margin: "0 0 12px",
              }}
            >
              Ou copie o código abaixo:
            </p>

            <PixCopyPasteField
              copyPasteCode={paymentDetails.copyPasteCode}
              transactionId={paymentDetails.transactionId}
              disabled={isExpired}
            />

            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14, marginTop: 6 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  margin: "0 0 6px",
                  color: "#374151",
                }}
              >
                Como pagar:
              </p>

              {[
                "Abra seu banco ou app de pagamento",
                "Escolha pagar via Pix",
                "Escaneie o QR Code ou cole o código",
                "Confirme o pagamento e acompanhe o status nesta página",
              ].map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#DCFCE7",
                      color: "#16A34A",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <OrderSummaryCard data={{ ...order, status }} />

        {status === "APPROVED" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Ticket style={{ width: 20, height: 20, color: "#2563EB" }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
                Voucher do pedido
              </h3>
            </div>

            <p style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: "#6B7280" }}>
              Baixe o voucher em PDF para apresentar no atendimento. Se você recebeu um
              link com token por e-mail ou WhatsApp, esta página também aceita esse
              token automaticamente.
            </p>

            <VoucherDownloadCard
              orderId={order.orderId}
              demo={order.demo}
              voucherToken={voucherToken ?? paymentDetails?.voucherToken}
            />

            {!voucherToken && !paymentDetails?.voucherToken && (
              <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#6B7280" }}>
                Se o download não for autorizado, use o link recebido por e-mail ou
                WhatsApp com o token de acesso.
              </p>
            )}
          </div>
        )}

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, color: "#111827" }}>
            Próximos passos
          </h3>

          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: "#4B5563",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {status === "PENDING" && (
              <>
                <li>Escaneie o QR Code ou copie o código Pix.</li>
                <li>Esta página atualiza o status automaticamente a cada 5 segundos.</li>
              </>
            )}

            {status === "APPROVED" && (
              <>
                <li>Baixe e salve o voucher em PDF.</li>
                <li>Apresente o voucher no atendimento.</li>
              </>
            )}

            {status === "EXPIRED" && (
              <>
                <li>O pedido expirou e não pode mais ser pago.</li>
                <li>Volte para a página de ingressos para gerar um novo pedido.</li>
              </>
            )}

            {status === "FAILED" && (
              <>
                <li>Houve uma falha na confirmação do pagamento.</li>
                <li>Tente novamente ou fale com o suporte.</li>
              </>
            )}

            {status === "CANCELLED" && (
              <>
                <li>O pedido foi cancelado e não pode ser reutilizado.</li>
                <li>Gere um novo pedido se ainda quiser concluir a compra.</li>
              </>
            )}
          </ul>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <a
              href={
                status === "EXPIRED" || status === "FAILED"
                  ? `/ingressos?retry=1&restore=1&fromOrder=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`
                  : "/ingressos"
              }
              style={{
                textDecoration: "none",
                borderRadius: 10,
                padding: "10px 14px",
                background: "#2563EB",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {status === "EXPIRED" || status === "FAILED"
                ? "Refazer pedido"
                : "Voltar para ingressos"}
            </a>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: "none",
                borderRadius: 10,
                padding: "10px 14px",
                background: "#25D366",
                color: "#fff",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              data-testid="button-whatsapp-support"
            >
              <MessageCircle style={{ width: 16, height: 16 }} />
              {status === "PENDING" && "Ajuda para pagar"}
              {status === "FAILED" && "Falar com suporte"}
              {status === "EXPIRED" && "Gerar novo pedido"}
              {status === "APPROVED" && "Dúvida sobre voucher"}
              {status === "CANCELLED" && "Atendimento comercial"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}