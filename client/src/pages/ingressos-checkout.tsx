import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ArrowLeft, ArrowRight, Clock, AlertCircle, CheckCircle2,
  Loader2, ShoppingCart, Phone, CreditCard, Smartphone, Search,
  Mail, User, MapPin, Lock, Shield, Check,
} from "lucide-react"
import { Link, useLocation } from "wouter"
import { useQuery, useMutation } from "@tanstack/react-query"
import { getCart, getCartTotal, clearCart, getSelectedDate, getCheckoutPrefill, clearCheckoutPrefill, type CartItem } from "@/lib/cart-store"
import { trackEvent } from "@/lib/analytics"
import { apiRequest } from "@/lib/queryClient"
import { IngressosSidebar } from "@/components/IngressosSidebar"
import { HomeHeader } from "@/components/home/HomeHeader"
import { HomeFooter } from "@/components/home/HomeFooter"
import { MobileCTABar } from "@/components/home/MobileCTABar"
import { PixQrCodePanel } from "@/components/checkout/PixQrCodePanel"
import { PixCopyPasteField } from "@/components/checkout/PixCopyPasteField"
import { PixCountdown } from "@/components/checkout/PixCountdown"
import { HoldTimerBanner } from "@/components/checkout/HoldTimerBanner"
import { GoalProgressBar, stageFromCheckoutStep } from "@/components/checkout/GoalProgressBar"
import { PaymentStatusBanner } from "@/components/checkout/PaymentStatusBanner"
import { CheckoutSummaryCard } from "@/components/checkout/CheckoutSummaryCard"
import { useTicketHold } from "@/hooks/useTicketHold"

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
}

function formatCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

function formatPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2")
}

function formatCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, "$1-$2")
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim()
}

function formatCardExpiry(v: string) {
  return v.replace(/\D/g, "").slice(0, 4)
    .replace(/(\d{2})(\d{1,2})/, "$1/$2")
}

type CheckoutStep = "email" | "dados" | "pagamento"
type PaymentMethod = "pix" | "cartao" | "apple-pay"
type PaymentStatus = "PENDING" | "APPROVED" | "EXPIRED" | "FAILED" | "CANCELLED"

interface PaymentData {
  transactionId: string
  status: PaymentStatus
  qrCodeBase64: string
  copyPasteCode: string
  expirationDate: string
  totalAmount: number
  originalTotal: number
  totalSavings: number
  isCombo: boolean
  items: CartItem[]
  demo: boolean
  voucherId?: string
  voucherToken?: string
}

const emailSchema = z.object({
  email: z.string().email("E-mail válido é obrigatório"),
})

const dadosSchema = z.object({
  firstName: z.string().min(2, "Nome deve ter ao menos 2 letras"),
  lastName: z.string().min(2, "Sobrenome deve ter ao menos 2 letras"),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10, "Telefone deve ter ao menos 10 dígitos")),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().length(11, "CPF deve ter 11 dígitos")),
  country: z.string(),
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().length(8, "CEP inválido (8 dígitos)")),
  estado: z.string().optional(),
  cidade: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().min(1, "Número obrigatório"),
  bairro: z.string().optional(),
  complemento: z.string().optional(),
  cupom: z.string().optional(),
})

type EmailFormValues = z.infer<typeof emailSchema>
type DadosFormValues = z.infer<typeof dadosSchema>

interface CardState {
  number: string
  holderName: string
  expiry: string
  cvv: string
}

const STEP_LABELS: { key: CheckoutStep; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "E-mail", icon: Mail },
  { key: "dados", label: "Dados", icon: User },
  { key: "pagamento", label: "Pagamento", icon: CreditCard },
]

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isDesktop
}

function ProgressBar({ step }: { step: CheckoutStep }) {
  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step)
  return (
    <div data-testid="checkout-progress">
      <div style={{ marginBottom: 14 }}>
        <GoalProgressBar
          stage={stageFromCheckoutStep(step)}
          tone="onDark"
          testId="checkout-goal-progress"
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 4px" }}>
        {STEP_LABELS.map((s, idx) => {
          const done = idx < stepIndex
          const active = idx === stepIndex
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", flex: idx < STEP_LABELS.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  data-testid={`checkout-step-${s.key}`}
                  style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: done ? "#22C55E" : active ? "#fff" : "rgba(255,255,255,0.3)",
                    color: done ? "#fff" : active ? "#2563EB" : "rgba(255,255,255,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800,
                    border: active ? "none" : done ? "none" : "1.5px solid rgba(255,255,255,0.4)",
                    boxShadow: active ? "0 0 0 3px rgba(253, 230, 138, 0.55)" : "none",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {done ? <Check style={{ width: 18, height: 18 }} /> : idx + 1}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  color: active ? "#fff" : done ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
                  marginTop: 4, whiteSpace: "nowrap",
                }}>
                  {s.label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: "0 8px",
                  background: done ? "#22C55E" : "rgba(255,255,255,0.25)",
                  borderRadius: 2, marginBottom: 16, transition: "background 0.3s",
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InputField({
  label, value, onChange, placeholder, type = "text", error, disabled, testId,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; error?: string; disabled?: boolean;
  testId?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input
        data-testid={testId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%", padding: "12px 14px", minHeight: 44,
          border: `1.5px solid ${error ? "#EF4444" : "#E5E7EB"}`,
          borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
          color: "#1F2937", background: disabled ? "#F9FAFB" : "#fff",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "#2563EB" }}
        onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = error ? "#EF4444" : "#E5E7EB" }}
      />
      {error && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{error}</p>}
    </div>
  )
}

export default function IngressosCheckoutPage() {
  const [, navigate] = useLocation()
  const isDesktop = useIsDesktop()
  const [cart] = useState<CartItem[]>(() => getCart())
  const [selectedDate] = useState<Date | null>(() => getSelectedDate())
  const [step, setStep] = useState<CheckoutStep>("email")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(30 * 60)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState("")
  const [cardConfirmed, setCardConfirmed] = useState(false)
  const [card, setCard] = useState<CardState>({ number: "", holderName: "", expiry: "", cvv: "" })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkoutPrefill = getCheckoutPrefill()
  const nameParts = (checkoutPrefill?.name ?? "").trim().split(" ").filter(Boolean)
  const prefillFirstName = nameParts.length > 0 ? nameParts[0] : ""
  const prefillLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: checkoutPrefill?.email ?? "" },
  })

  const dadosForm = useForm<DadosFormValues>({
    resolver: zodResolver(dadosSchema),
    defaultValues: {
      firstName: prefillFirstName,
      lastName: prefillLastName,
      phone: checkoutPrefill?.phone ?? "",
      cpf: checkoutPrefill?.cpf ?? "",
      country: "Brasil", cep: "", estado: "", cidade: "",
      endereco: "", numero: "", bairro: "", complemento: "", cupom: "",
    },
  })

  const emailValue = emailForm.watch("email")
  const dadosValues = dadosForm.watch()

  const total = getCartTotal(cart)
  const {
    holdId,
    sessionId,
    minutes: holdMinutes,
    seconds: holdSeconds,
    isExpired: holdExpired,
    error: holdError,
    isAcquiring: holdAcquiring,
    acquire: reacquireHold,
  } = useTicketHold(cart)

  useEffect(() => {
    if (cart.length === 0) navigate("/ingressos")
  }, [cart.length, navigate])

  useEffect(() => {
    if (step === "pagamento") {
      trackEvent("pix_checkout_view", { paymentMethod, hasPayment: Boolean(paymentData) })
    } else {
      trackEvent("checkout_view", { step })
    }
    // paymentData intencional fora das deps — evita re-track a cada QR
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paymentMethod])

  useEffect(() => {
    if (step !== "pagamento" || paymentMethod !== "pix" || !paymentData) return
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [step, paymentMethod, paymentData])

 const demoConfirmMutation = useMutation({
  mutationFn: async (transactionId: string) => {
    const res = await apiRequest("POST", `/api/payments/tickets/${transactionId}/demo-confirm`, {})
    return res.json() as Promise<{ status: string; paid: boolean }>
  },
  onSuccess: (data) => {
    if (data.paid || data.status === "APPROVED") {
      trackEvent("pix_payment_confirmed", { transactionId: paymentData?.transactionId, demo: true })
      clearCart()
      const tok = paymentData?.voucherToken ? `?token=${encodeURIComponent(paymentData.voucherToken)}` : ""
      navigate(`/pedido/${paymentData?.transactionId}${tok}`)
    }
  },
 })
 const pixIdempotencyKeyRef = useRef<string | null>(null)
 const createPaymentMutation = useMutation({
  mutationFn: async (opts?: { holdId?: string | null }) => {
    const dados = dadosForm.getValues()
    const payload = {
      items: cart.map((c) => ({
        ticketId: c.ticketId,
        quantity: c.quantity,
      })),
      customer: {
        name: `${dados.firstName.trim()} ${dados.lastName.trim()}`,
        email: emailForm.getValues("email").trim(),
        cpf: dados.cpf.replace(/\D/g, ""),
        phone: dados.phone.replace(/\D/g, ""),
      },
      holdId: opts?.holdId ?? holdId ?? undefined,
      sessionId,
    }
    // Fase 10: mesma chave em retries da mesma tentativa de Pix
    if (!pixIdempotencyKeyRef.current) {
      pixIdempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tkt-${sessionId}-${Date.now()}`
    }
    const res = await apiRequest("POST", "/api/payments/tickets/create", payload, {
      headers: { "Idempotency-Key": pixIdempotencyKeyRef.current },
    })
    return res.json() as Promise<PaymentData>
  },
  onSuccess: (data) => {
    setPaymentData(data)
    const expMs = new Date(data.expirationDate).getTime()
    const diffSec = Math.max(0, Math.floor((expMs - Date.now()) / 1000))
    setSecondsLeft(diffSec)
    trackEvent("pix_qr_visible", { transactionId: data.transactionId })
    clearCheckoutPrefill()

    const tok = data.voucherToken ? `?token=${encodeURIComponent(data.voucherToken)}` : ""
    navigate(`/pedido/${data.transactionId}${tok}`)
  },
})
 const cancelPaymentMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await apiRequest("POST", `/api/payments/tickets/${transactionId}/cancel`, {})
      return res.json() as Promise<{ cancelled: boolean; status: string }>
    },
    onSuccess: () => {
      trackEvent("pix_cancelled", { transactionId: paymentData?.transactionId })
      navigate("/ingressos")
    },
  })

  
  const isTerminal = (s: PaymentStatus) =>
    s === "APPROVED" || s === "EXPIRED" || s === "FAILED" || s === "CANCELLED"

  const { data: statusData } = useQuery({
    queryKey: ["/api/payments/tickets", paymentData?.transactionId, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/payments/tickets/${paymentData!.transactionId}/status`)
      return res.json() as Promise<{ status: PaymentStatus; paid: boolean }>
    },
    enabled:
      !!paymentData &&
      step === "pagamento" &&
      paymentMethod === "pix" &&
      !isTerminal(paymentData?.status ?? "PENDING") &&
      secondsLeft !== 0,
    refetchInterval: (query) => {
      const data = query.state.data as { status: PaymentStatus; paid: boolean } | undefined
      if (!data) return 3000
      return isTerminal(data.status) ? false : 3000
    },
  })

 useEffect(() => {
  if (!statusData) return
  if (statusData.paid || statusData.status === "APPROVED") {
    trackEvent("pix_payment_confirmed", { transactionId: paymentData?.transactionId })
    clearCart()
    clearCheckoutPrefill()
    const tok = paymentData?.voucherToken ? `?token=${encodeURIComponent(paymentData.voucherToken)}` : ""
    navigate(`/pedido/${paymentData?.transactionId}${tok}`)
    return
  }
  if (statusData.status === "EXPIRED") {
    trackEvent("pix_payment_expired", { transactionId: paymentData?.transactionId })
  } else if (statusData.status === "FAILED") {
    trackEvent("pix_payment_failed", { transactionId: paymentData?.transactionId })
  }
}, [statusData, paymentData, navigate])

  async function fetchViaCep() {
    const clean = dadosForm.getValues("cep").replace(/\D/g, "")
    if (clean.length !== 8) { setCepError("CEP inválido (8 dígitos)"); return }
    setCepLoading(true)
    setCepError("")
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const data = await res.json()
      if (data.erro) { setCepError("CEP não encontrado"); return }
      dadosForm.setValue("estado", data.uf || "")
      dadosForm.setValue("cidade", data.localidade || "")
      dadosForm.setValue("endereco", data.logradouro || "")
      dadosForm.setValue("bairro", data.bairro || "")
    } catch {
      setCepError("Erro ao buscar CEP. Tente novamente.")
    } finally {
      setCepLoading(false)
    }
  }

  function handleNextEmail(values: EmailFormValues) {
    trackEvent("checkout_step_email_done")
    setStep("dados")
  }

  function handleNextDados(values: DadosFormValues) {
    trackEvent("checkout_step_dados_done")
    setStep("pagamento")
  }

  async function handleConfirmPayment() {
    let activeHoldId = holdId
    if (holdExpired || holdError || !activeHoldId) {
      const renewed = await reacquireHold()
      if (!renewed) return
      activeHoldId = renewed.holdId
    }
    if (paymentMethod === "pix") {
      createPaymentMutation.mutate({ holdId: activeHoldId })
    } else if (paymentMethod === "cartao") {
      trackEvent("checkout_card_simulated")
      setCardConfirmed(true)
    }
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const seconds = String(secondsLeft % 60).padStart(2, "0")
  const isExpired = secondsLeft === 0
  const currentStatus: PaymentStatus = statusData?.status ?? paymentData?.status ?? "PENDING"

  if (cart.length === 0) return null

  const isApplePay = typeof window !== "undefined" && "ApplePaySession" in window
  if (paymentData && paymentMethod === "pix") {
  return (
    <div className="rsv-subpage" style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      <HomeHeader />
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <Loader2
            style={{
              width: 28,
              height: 28,
              color: "#2563EB",
              margin: "0 auto 12px",
              animation: "spin 1s linear infinite",
            }}
          />
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
            Redirecionando para o acompanhamento do pedido
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>
            Seu Pix foi gerado. Você será levado para a página do pedido para acompanhar o pagamento.
          </p>
        </div>
      </div>
      <HomeFooter />
      <MobileCTABar />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

  const holdBannerProps = {
    minutes: holdMinutes,
    seconds: holdSeconds,
    isExpired: holdExpired,
    isAcquiring: holdAcquiring,
    error: holdError,
    onRetry: () => { void reacquireHold() },
  }

  const sidebarProps = {
    cart,
    total,
    selectedDate,
    muteCheckoutCta: step === "pagamento" && !paymentData,
    holdSlot: !paymentData ? (
      <div>
        <HoldTimerBanner {...holdBannerProps} variant="compact" />
        <div style={{ marginBottom: 12 }} data-testid="sidebar-goal-wrap">
          <GoalProgressBar
            stage={stageFromCheckoutStep(step)}
            tone="onLight"
            compact
            testId="sidebar-goal-progress"
          />
        </div>
      </div>
    ) : undefined,
    onCheckout: () => {
      if (step === "email") emailForm.handleSubmit(handleNextEmail)()
      else if (step === "dados") dadosForm.handleSubmit(handleNextDados)()
      else if (step === "pagamento" && !paymentData && !cardConfirmed) void handleConfirmPayment()
    },
  }

  return (
    <div className="rsv-subpage" style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      <HomeHeader />

      <div style={{
        background: "linear-gradient(135deg, #0891B2 0%, #2563EB 100%)",
        color: "#fff", padding: "20px 20px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => {
              if (step === "email") navigate("/ingressos")
              else if (step === "dados") setStep("email")
              else if (step === "pagamento" && !paymentData) setStep("dados")
            }}
            data-testid="link-back-checkout"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#fff", display: "flex", alignItems: "center", padding: 0,
            }}
          >
            <ArrowLeft style={{ width: 22, height: 22 }} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }} data-testid="text-checkout-title">
            {step === "email" ? "Seu E-mail" : step === "dados" ? "Seus Dados" : "Pagamento"}
          </h1>
        </div>
        <ProgressBar step={step} />
      </div>

      <div style={{
        background: "#fff", borderBottom: "1px solid #F3F4F6",
        padding: "10px 20px",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 24, flexWrap: "wrap",
        }}>
          {[
            { icon: <Lock style={{ width: 13, height: 13, color: "#16A34A" }} />, label: "Ambiente SSL seguro" },
            { icon: <Shield style={{ width: 13, height: 13, color: "#2563EB" }} />, label: "Pagamento 100% protegido" },
            { icon: <Phone style={{ width: 13, height: 13, color: "#25D366" }} />, label: "Suporte via WhatsApp" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {icon}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "flex-start",
        maxWidth: isDesktop ? 1100 : undefined,
        margin: isDesktop ? "0 auto" : undefined,
      }}>
        <div style={{ flex: 1, minWidth: 0, padding: isDesktop ? "24px 0 24px 24px" : "0" }}>
          <div style={{ padding: isDesktop ? 0 : 16, maxWidth: 560 }}>

            {/* Fase 6: no mobile o hold fica sticky no topo do formulário; no desktop vai na sidebar */}
            {!paymentData && !isDesktop && (
              <div
                style={{ position: "sticky", top: 0, zIndex: 40, paddingTop: 4, background: "#F8FAFC" }}
                data-testid="hold-sticky-mobile"
              >
                <HoldTimerBanner {...holdBannerProps} variant="full" />
              </div>
            )}

            {step === "email" && (
              <form
                onSubmit={emailForm.handleSubmit(handleNextEmail)}
                data-testid="card-email-step"
                style={{
                  background: "#fff", borderRadius: 16, padding: 24,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 12px",
                  }}>
                    <Mail style={{ width: 26, height: 26, color: "#2563EB" }} />
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "#1F2937" }}>
                    Como você quer entrar?
                  </h2>
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                    Informe seu e-mail para continuar com a compra
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="button-continue-google"
                  style={{
                    width: "100%", padding: "13px 0", minHeight: 44, border: "1.5px solid #E5E7EB",
                    borderRadius: 12, background: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                  onClick={() => {
                    trackEvent("checkout_google_click")
                    if (!emailForm.getValues("email")) emailForm.setValue("email", "usuario@gmail.com")
                    setTimeout(() => setStep("dados"), 300)
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continuar com Google
                </button>

                <button
                  type="button"
                  data-testid="button-continue-apple"
                  style={{
                    width: "100%", padding: "13px 0", minHeight: 44, border: "none",
                    borderRadius: 12, background: "#000", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 20,
                  }}
                  onClick={() => {
                    trackEvent("checkout_apple_click")
                    if (!emailForm.getValues("email")) emailForm.setValue("email", "usuario@icloud.com")
                    setTimeout(() => setStep("dados"), 300)
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 814 1000" fill="white">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.3-57.4-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                  </svg>
                  Continuar com Apple
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
                  <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>ou com seu e-mail</span>
                  <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    E-mail
                  </label>
                  <input
                    data-testid="input-email"
                    type="email"
                    {...emailForm.register("email")}
                    placeholder="seu@email.com.br"
                    style={{
                      width: "100%", padding: "12px 14px", minHeight: 44,
                      border: `1.5px solid ${emailForm.formState.errors.email ? "#EF4444" : "#E5E7EB"}`,
                      borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
                      color: "#1F2937",
                    }}
                  />
                  {emailForm.formState.errors.email && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>
                      {emailForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  data-testid="button-next-email"
                  style={{
                    width: "100%", padding: "14px 0", minHeight: 48, border: "none", borderRadius: 12,
                    background: "linear-gradient(135deg, #0891B2, #2563EB)",
                    color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  Continuar
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </button>

                <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
                  <Lock style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  Seus dados são protegidos e não serão compartilhados
                </p>
              </form>
            )}

            {step === "dados" && (
              <form
                onSubmit={dadosForm.handleSubmit(handleNextDados)}
                data-testid="card-dados-step"
                style={{
                  background: "#fff", borderRadius: 16, padding: 24,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 20px", color: "#1F2937" }}>
                  Dados Pessoais e Endereço
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                      Primeiro Nome *
                    </label>
                    <input
                      data-testid="input-firstName"
                      {...dadosForm.register("firstName")}
                      placeholder="João"
                      style={{
                        width: "100%", padding: "12px 14px",
                        border: `1.5px solid ${dadosForm.formState.errors.firstName ? "#EF4444" : "#E5E7EB"}`,
                        borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1F2937",
                      }}
                    />
                    {dadosForm.formState.errors.firstName && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{dadosForm.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                      Último Nome *
                    </label>
                    <input
                      data-testid="input-lastName"
                      {...dadosForm.register("lastName")}
                      placeholder="Silva"
                      style={{
                        width: "100%", padding: "12px 14px",
                        border: `1.5px solid ${dadosForm.formState.errors.lastName ? "#EF4444" : "#E5E7EB"}`,
                        borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1F2937",
                      }}
                    />
                    {dadosForm.formState.errors.lastName && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{dadosForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Telefone com DDD *
                  </label>
                  <input
                    data-testid="input-phone"
                    type="tel"
                    value={dadosValues.phone}
                    onChange={(e) => dadosForm.setValue("phone", formatPhone(e.target.value), { shouldValidate: true })}
                    placeholder="(65) 99999-0000"
                    style={{
                      width: "100%", padding: "12px 14px",
                      border: `1.5px solid ${dadosForm.formState.errors.phone ? "#EF4444" : "#E5E7EB"}`,
                      borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1F2937",
                    }}
                  />
                  {dadosForm.formState.errors.phone && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{dadosForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    CPF *
                  </label>
                  <input
                    data-testid="input-cpf"
                    value={dadosValues.cpf}
                    onChange={(e) => dadosForm.setValue("cpf", formatCpf(e.target.value), { shouldValidate: true })}
                    placeholder="000.000.000-00"
                    style={{
                      width: "100%", padding: "12px 14px",
                      border: `1.5px solid ${dadosForm.formState.errors.cpf ? "#EF4444" : "#E5E7EB"}`,
                      borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1F2937",
                    }}
                  />
                  {dadosForm.formState.errors.cpf && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{dadosForm.formState.errors.cpf.message}</p>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #F3F4F6", margin: "4px 0 16px" }} />
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px", color: "#374151" }}>
                  Endereço
                </h4>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>País</label>
                  <input
                    data-testid="input-country"
                    value={dadosValues.country}
                    disabled
                    style={{
                      width: "100%", padding: "12px 14px",
                      border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none",
                      boxSizing: "border-box", color: "#1F2937", background: "#F9FAFB",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    CEP *
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      data-testid="input-cep"
                      type="text"
                      value={dadosValues.cep}
                      onChange={(e) => {
                        dadosForm.setValue("cep", formatCep(e.target.value), { shouldValidate: true })
                        setCepError("")
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchViaCep() } }}
                      placeholder="00000-000"
                      style={{
                        flex: 1, padding: "12px 14px",
                        border: `1.5px solid ${(dadosForm.formState.errors.cep || cepError) ? "#EF4444" : "#E5E7EB"}`,
                        borderRadius: 10, fontSize: 14, outline: "none", color: "#1F2937",
                      }}
                    />
                    <button
                      type="button"
                      data-testid="button-search-cep"
                      onClick={fetchViaCep}
                      disabled={cepLoading}
                      style={{
                        padding: "12px 16px", border: "none", borderRadius: 10,
                        background: cepLoading ? "#9CA3AF" : "#2563EB",
                        color: "#fff", fontWeight: 700, fontSize: 13,
                        cursor: cepLoading ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                      }}
                    >
                      {cepLoading
                        ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                        : <Search style={{ width: 16, height: 16 }} />
                      }
                      {cepLoading ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                  {(dadosForm.formState.errors.cep || cepError) && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>
                      {dadosForm.formState.errors.cep?.message || cepError}
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                  <InputField
                    label="Estado"
                    value={dadosValues.estado ?? ""}
                    onChange={(v) => dadosForm.setValue("estado", v)}
                    placeholder="GO"
                    testId="input-estado"
                  />
                  <InputField
                    label="Cidade"
                    value={dadosValues.cidade ?? ""}
                    onChange={(v) => dadosForm.setValue("cidade", v)}
                    placeholder="Caldas Novas"
                    testId="input-cidade"
                  />
                </div>

                <InputField
                  label="Logradouro"
                  value={dadosValues.endereco ?? ""}
                  onChange={(v) => dadosForm.setValue("endereco", v)}
                  placeholder="Rua, Avenida..."
                  testId="input-endereco"
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                      Número *
                    </label>
                    <input
                      data-testid="input-numero"
                      {...dadosForm.register("numero")}
                      placeholder="123"
                      style={{
                        width: "100%", padding: "12px 14px",
                        border: `1.5px solid ${dadosForm.formState.errors.numero ? "#EF4444" : "#E5E7EB"}`,
                        borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#1F2937",
                      }}
                    />
                    {dadosForm.formState.errors.numero && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{dadosForm.formState.errors.numero.message}</p>
                    )}
                  </div>
                  <InputField
                    label="Bairro"
                    value={dadosValues.bairro ?? ""}
                    onChange={(v) => dadosForm.setValue("bairro", v)}
                    placeholder="Centro"
                    testId="input-bairro"
                  />
                </div>

                <InputField
                  label="Complemento"
                  value={dadosValues.complemento ?? ""}
                  onChange={(v) => dadosForm.setValue("complemento", v)}
                  placeholder="Apto, Sala... (opcional)"
                  testId="input-complemento"
                />

                <div style={{ borderTop: "1px solid #F3F4F6", margin: "4px 0 16px" }} />

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                    Cupom de desconto
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      data-testid="input-cupom"
                      type="text"
                      value={dadosValues.cupom ?? ""}
                      onChange={(e) => dadosForm.setValue("cupom", e.target.value.toUpperCase())}
                      placeholder="Ex: RSV10"
                      style={{
                        flex: 1, padding: "12px 14px", minHeight: 44,
                        border: "1.5px solid #E5E7EB",
                        borderRadius: 10, fontSize: 14, outline: "none", color: "#1F2937",
                        fontFamily: "monospace", letterSpacing: 1,
                      }}
                    />
                    <button
                      type="button"
                      data-testid="button-apply-cupom"
                      style={{
                        padding: "12px 16px", minHeight: 44, border: "none", borderRadius: 10,
                        background: "#F3F4F6", color: "#374151",
                        fontWeight: 700, fontSize: 13, cursor: "pointer",
                      }}
                      onClick={() => trackEvent("cupom_apply_attempt", { cupom: dadosValues.cupom })}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="button-next-dados"
                  style={{
                    width: "100%", padding: "14px 0", minHeight: 48, border: "none", borderRadius: 12,
                    background: "linear-gradient(135deg, #0891B2, #2563EB)",
                    color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  Continuar para Pagamento
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </form>
            )}

            {step === "pagamento" && (
              <div data-testid="card-pagamento-step">
                {!paymentData && (
                  <div style={{
                    background: "#fff", borderRadius: 16, padding: 24,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16,
                  }}>
                    {/* Squint Test / Von Restorff: Pix como único CTA protagonista */}
                    <div
                      data-testid="payment-pix-hero"
                      style={{
                        border: "2px solid #22C55E",
                        borderRadius: 14,
                        padding: "14px 16px",
                        marginBottom: 16,
                        background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: "linear-gradient(135deg, #22C55E, #16A34A)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="24" height="24" viewBox="0 0 512 512" fill="white" aria-hidden>
                          <path d="M242.4 292.5C247.8 287.1 255.1 284.1 262.7 284.1C270.2 284.1 277.5 287.1 282.9 292.5L376.1 385.7C387.3 396.9 405.4 396.9 416.7 385.7L492.3 310.1C514.8 287.6 514.8 251.2 492.3 228.7L416.7 153.2C405.4 142 387.3 142 376.1 153.2L283.4 245.8C278 251.2 270.8 254.2 263.2 254.2C255.6 254.2 248.5 251.2 243.1 245.8L150.3 153C139.1 141.8 120.1 141.8 109.8 153L34.19 228.6C11.69 251.1 11.69 287.5 34.19 310L109.8 385.6C120.1 396.8 138.1 396.8 150.3 385.6L242.4 292.5z"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#14532D" }}>Pagar com Pix</span>
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                            background: "#22C55E", color: "#fff",
                          }}>
                            Recomendado
                          </span>
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#166534" }}>
                          Aprovação imediata · sem cartão · 100% seguro
                        </p>
                      </div>
                    </div>

                    <CheckoutSummaryCard
                      items={cart}
                      totalAmount={total}
                      originalTotal={total}
                      totalSavings={0}
                      isCombo={false}
                      cupom={dadosValues.cupom || undefined}
                    />

                    {paymentMethod === "pix" && (
                      <p
                        data-testid="zeigarnik-payment-nudge"
                        style={{
                          margin: "14px 0 0",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
                          border: "1px solid #FDE68A",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#92400E",
                          textAlign: "center",
                        }}
                      >
                        Quase lá — complete o Pix para não perder a reserva
                      </p>
                    )}

                    {paymentMethod === "pix" && (
                      <button
                        data-testid="button-confirm-payment"
                        onClick={() => { void handleConfirmPayment() }}
                        disabled={createPaymentMutation.isPending || holdAcquiring}
                        style={{
                          width: "100%", padding: "18px 0", border: "none", borderRadius: 14,
                          marginTop: 10, marginBottom: 8,
                          background: (createPaymentMutation.isPending || holdAcquiring)
                            ? "#9CA3AF"
                            : holdExpired || holdError
                              ? "linear-gradient(135deg, #F97316, #EA580C)"
                              : "linear-gradient(135deg, #22C55E, #16A34A)",
                          color: "#fff", fontSize: 17, fontWeight: 800,
                          cursor: (createPaymentMutation.isPending || holdAcquiring) ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
                          minHeight: 56,
                          transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      >
                        {createPaymentMutation.isPending
                          ? <><Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} /> Processando...</>
                          : holdExpired || holdError
                            ? <><Clock style={{ width: 20, height: 20 }} /> Renovar reserva e pagar</>
                            : <><ShoppingCart style={{ width: 20, height: 20 }} /> Gerar QR Code Pix</>}
                      </button>
                    )}

                    <p style={{ margin: "0 0 16px", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
                      <Lock style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                      Pagamento 100% seguro • Dados criptografados
                    </p>

                    {/* Hick: alternativas fora do caminho crítico */}
                    <details
                      data-testid="payment-other-methods"
                      style={{
                        borderTop: "1px solid #F3F4F6",
                        paddingTop: 12,
                        marginBottom: paymentMethod !== "pix" ? 16 : 0,
                      }}
                      open={paymentMethod !== "pix"}
                      onToggle={(e) => {
                        if (!(e.target as HTMLDetailsElement).open && paymentMethod !== "pix") {
                          setPaymentMethod("pix")
                        }
                      }}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#6B7280",
                          listStyle: "none",
                          userSelect: "none",
                        }}
                      >
                        Outras formas de pagamento
                      </summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                        {([
                          {
                            key: "cartao" as PaymentMethod,
                            label: "Cartão de Crédito",
                            sublabel: "Visa, Mastercard, Elo, Amex",
                          },
                          {
                            key: "apple-pay" as PaymentMethod,
                            label: "Apple Pay",
                            sublabel: isApplePay ? "Disponível neste dispositivo" : "Somente Safari/iOS/macOS",
                          },
                        ]).map(({ key, label, sublabel }) => (
                          <button
                            key={key}
                            type="button"
                            data-testid={`button-payment-${key}`}
                            onClick={() => setPaymentMethod(key)}
                            style={{
                              width: "100%", border: `1.5px solid ${paymentMethod === key ? "#2563EB" : "#E5E7EB"}`,
                              borderRadius: 10, padding: "12px 14px",
                              minHeight: 44,
                              background: paymentMethod === key ? "#EFF6FF" : "#FAFAFA",
                              cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{label}</div>
                            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{sublabel}</div>
                          </button>
                        ))}
                        <button
                          type="button"
                          data-testid="button-payment-pix"
                          onClick={() => setPaymentMethod("pix")}
                          style={{
                            width: "100%", border: "1.5px solid #BBF7D0",
                            borderRadius: 10, padding: "10px 14px",
                            background: "#F0FDF4", cursor: "pointer", textAlign: "left",
                            fontSize: 12, fontWeight: 700, color: "#15803D",
                          }}
                        >
                          Voltar para Pix (recomendado)
                        </button>
                      </div>
                    </details>

                    {paymentMethod === "cartao" && (
                      <div style={{
                        background: "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 20,
                        border: "1px solid #E5E7EB",
                      }} data-testid="card-credit-fields">
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>
                          Dados do Cartão
                        </div>
                        <InputField
                          label="Número do Cartão"
                          value={card.number}
                          onChange={(v) => setCard(p => ({ ...p, number: formatCardNumber(v) }))}
                          placeholder="0000 0000 0000 0000"
                          testId="input-card-number"
                        />
                        <InputField
                          label="Nome no Cartão"
                          value={card.holderName}
                          onChange={(v) => setCard(p => ({ ...p, holderName: v.toUpperCase() }))}
                          placeholder="NOME SOBRENOME"
                          testId="input-card-name"
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                          <InputField
                            label="Validade"
                            value={card.expiry}
                            onChange={(v) => setCard(p => ({ ...p, expiry: formatCardExpiry(v) }))}
                            placeholder="MM/AA"
                            testId="input-card-expiry"
                          />
                          <InputField
                            label="CVV"
                            value={card.cvv}
                            onChange={(v) => setCard(p => ({ ...p, cvv: v.replace(/\D/g, "").slice(0, 4) }))}
                            placeholder="000"
                            testId="input-card-cvv"
                          />
                        </div>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 10px", background: "#FFF7ED",
                          borderRadius: 8, border: "1px solid #FED7AA",
                        }}>
                          <AlertCircle style={{ width: 14, height: 14, color: "#D97706", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "#92400E" }}>
                            Simulação visual — nenhum dado é processado
                          </span>
                        </div>
                      </div>
                    )}

                    {paymentMethod === "apple-pay" && (
                      <div style={{
                        background: "#F9FAFB", borderRadius: 12, padding: 20,
                        marginBottom: 20, textAlign: "center",
                        border: "1px solid #E5E7EB",
                      }} data-testid="card-apple-pay">
                        {isApplePay ? (
                          <button
                            style={{
                              width: "100%", padding: "14px 0", border: "none",
                              borderRadius: 10, background: "#000", color: "#fff",
                              fontSize: 15, fontWeight: 700, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}
                            data-testid="button-apple-pay-confirm"
                            onClick={() => trackEvent("apple_pay_click")}
                          >
                            <svg width="20" height="20" viewBox="0 0 814 1000" fill="white">
                              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.3-57.4-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                            </svg>
                            Pay com Apple Pay
                          </button>
                        ) : (
                          <div>
                            <Smartphone style={{ width: 40, height: 40, color: "#9CA3AF", margin: "0 auto 10px" }} />
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", margin: "0 0 4px" }}>
                              Não disponível neste dispositivo
                            </p>
                            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
                              Apple Pay requer um dispositivo Apple com Safari
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {createPaymentMutation.isError && (
                      <div style={{
                        background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
                        padding: "10px 14px", marginBottom: 14, marginTop: 12,
                        display: "flex", alignItems: "center", gap: 8,
                      }} data-testid="alert-payment-error">
                        <AlertCircle style={{ width: 16, height: 16, color: "#EF4444", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#DC2626" }}>
                          {paymentMethod === "pix" ? "Erro ao gerar Pix. Tente novamente." : "Erro ao processar. Tente novamente."}
                        </span>
                      </div>
                    )}

                    {paymentMethod === "cartao" && (
                      <button
                        data-testid="button-confirm-card"
                        onClick={() => { void handleConfirmPayment() }}
                        style={{
                          width: "100%", padding: "14px 0", border: "none", borderRadius: 12,
                          marginTop: 12,
                          background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                          color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          minHeight: 48,
                        }}
                      >
                        <CreditCard style={{ width: 18, height: 18 }} />
                        Pagar com Cartão (simulado)
                      </button>
                    )}
                  </div>
                )}

                {paymentData && paymentMethod === "pix" && (
                  <div style={{
                    background: "#fff", borderRadius: 16, padding: 24,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  }} data-testid="card-pix-payment">

                    <PaymentStatusBanner status={currentStatus} isExpired={isExpired} />

                    {paymentData.demo && (
                      <div style={{
                        background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10,
                        padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#1D4ED8",
                      }} data-testid="badge-demo-mode">
                        Modo demonstração — nenhum pagamento real será processado
                      </div>
                    )}

                    {currentStatus === "PENDING" && !isExpired && (
                      <PixCountdown minutes={minutes} seconds={seconds} isExpired={isExpired} />
                    )}

                    <PixQrCodePanel qrCodeBase64={paymentData.qrCodeBase64} />

                    <p style={{ textAlign: "center", fontSize: 13, color: "#6B7280", margin: "0 0 12px" }}>
                      Ou copie o código abaixo:
                    </p>

                    <PixCopyPasteField
                      copyPasteCode={paymentData.copyPasteCode}
                      transactionId={paymentData.transactionId}
                      disabled={isExpired}
                    />

                    <CheckoutSummaryCard
                      items={paymentData.items}
                      totalAmount={paymentData.totalAmount}
                      originalTotal={paymentData.originalTotal}
                      totalSavings={paymentData.totalSavings}
                      isCombo={paymentData.isCombo}
                      cupom={dadosValues.cupom || undefined}
                    />

                    <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14, marginTop: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px", color: "#374151" }}>Como pagar:</p>
                      {["Abra seu banco ou app de pagamento", "Escolha pagar via Pix", "Escaneie o QR Code ou cole o código", "Confirme e pronto!"].map((st, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: "50%", background: "#DCFCE7",
                            color: "#16A34A", fontSize: 12, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>{i + 1}</span>
                          <span style={{ fontSize: 13, color: "#6B7280" }}>{st}</span>
                        </div>
                      ))}
                    </div>

                    {paymentData.demo && currentStatus === "PENDING" && !isExpired && (
                      <button
                        data-testid="button-demo-confirm-pix"
                        onClick={() => demoConfirmMutation.mutate(paymentData.transactionId)}
                        disabled={demoConfirmMutation.isPending}
                        style={{
                          width: "100%", padding: "13px 0", border: "none", borderRadius: 10,
                          background: demoConfirmMutation.isPending ? "#9CA3AF" : "linear-gradient(135deg, #22C55E, #16A34A)",
                          color: "#fff", fontSize: 14, fontWeight: 700,
                          cursor: demoConfirmMutation.isPending ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          marginTop: 14,
                        }}
                      >
                        {demoConfirmMutation.isPending
                          ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Confirmando...</>
                          : <><CheckCircle2 style={{ width: 16, height: 16 }} /> Simular Pagamento (Demo)</>
                        }
                      </button>
                    )}

                    {currentStatus === "PENDING" && !isExpired && (
                      <button
                        data-testid="button-cancel-pix"
                        onClick={() => cancelPaymentMutation.mutate(paymentData.transactionId)}
                        disabled={cancelPaymentMutation.isPending}
                        style={{
                          width: "100%", padding: "11px 0", border: "1.5px solid #E5E7EB", borderRadius: 10,
                          background: "#fff", color: "#6B7280",
                          fontSize: 13, fontWeight: 600,
                          cursor: cancelPaymentMutation.isPending ? "not-allowed" : "pointer",
                          marginTop: 10,
                        }}
                      >
                        {cancelPaymentMutation.isPending ? "Cancelando..." : "Cancelar e voltar"}
                      </button>
                    )}

                    <a
                      href="https://wa.me/5564993197555?text=Preciso de ajuda com meu pagamento Pix de ingressos"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-checkout-support"
                      onClick={() => trackEvent("support_whatsapp_click")}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "12px 0", background: "#F0FDF4", borderRadius: 10,
                        marginTop: 14, color: "#16A34A", fontSize: 13, fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <Phone style={{ width: 16, height: 16 }} />
                      Precisa de ajuda? Fale no WhatsApp
                    </a>
                  </div>
                )}

                {cardConfirmed && paymentMethod === "cartao" && (
                  <div style={{
                    background: "#fff", borderRadius: 16, padding: 24,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    textAlign: "center",
                  }} data-testid="card-cartao-simulated">
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      background: "linear-gradient(135deg, #DCFCE7, #BBF7D0)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 16px",
                    }}>
                      <CheckCircle2 style={{ width: 36, height: 36, color: "#16A34A" }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1F2937", margin: "0 0 8px" }}>
                      Pedido registrado!
                    </h3>
                    <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 4px" }}>
                      Simulação de cartão concluída com sucesso.
                    </p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 20px" }}>
                      (Modo demonstração — nenhuma cobrança real foi realizada)
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => { setPaymentMethod("pix"); setCardConfirmed(false) }}
                        style={{
                          padding: "12px 20px", border: "none", borderRadius: 10,
                          background: "linear-gradient(135deg, #22C55E, #16A34A)",
                          color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                        }}
                        data-testid="button-cartao-try-pix"
                      >
                        Prefiro pagar com Pix
                      </button>
                      <a
                        href="https://wa.me/5564993197555?text=Quero finalizar meu pedido de ingressos"
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          padding: "12px 20px", border: "none", borderRadius: 10,
                          background: "#F0FDF4", color: "#16A34A",
                          fontWeight: 700, fontSize: 14, textDecoration: "none",
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                        data-testid="link-cartao-whatsapp"
                      >
                        <Phone style={{ width: 16, height: 16 }} />
                        Finalizar no WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {isDesktop && (
          <div style={{ width: 340, flexShrink: 0, padding: "24px 24px 24px 0" }}>
            <IngressosSidebar {...sidebarProps} />
          </div>
        )}
      </div>

      {!isDesktop && (
        <IngressosSidebar {...sidebarProps} />
      )}

      <HomeFooter />
      <MobileCTABar />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
