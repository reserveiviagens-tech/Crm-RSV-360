# 03-CHANGELOG-IMPLEMENTACAO

## 2026-10-17
### Sequência integrada — Redis oficial + hardening CRM + Smart Hub live
- Redis: `rsv360-redis` alpine :6379; `REDIS_DISABLED=false`; BullMQ (reservas/propostas/importações/auctions) OK; PONG
- CRM: `CartStickyBar` max-width 960 (desktop); Pix sem split preservado
- Smart Hub: `smart-hub-live.ts` agrega relatorios/financeiro/anfitriao/campanhas + CRM analytics; layout `max-w-7xl` + grid 5/7
- Docs: HANDOFF + CHECKPOINT + REDIS-LOCAL
- Próximo: smoke desktop Smart Hub + `/ingressos` → Fase 15 (Scrapling) quando pedido

## 2026-10-17
### Master UI — Fase 16 Smart Dashboard V8/V13 (Turismo)
- `/dashboard/smart-hub`: KPIs glass, heatmap sazonalidade, funil ingressos, Smart Hub automações
- Links Control Center / Flash / OTA / Financeiro / CRM ingressos
- Sidebar atualizada; type-check Turismo OK
- Próximo: smoke visual → Fase 15 (Scrapling) quando pedido

## 2026-10-17
### Master UI — Fase 12 Tracking & analytics audit
- `analytics.ts`: sessionId + funil + flush batch; gaps Pix/combo/BFF/cross-sell fechados
- `POST /api/analytics/events` + `GET /api/analytics/recent`
- Smoke unit analytics OK; check OK
- Próximo: Fase 15/16 quando pedido

## 2026-10-17
### Master UI — Fase 11 BFF & payload optimization
- `GET /api/bff/orders/:id?view=full|lite` agrega pedido/status/Pix
- CPF mascarado; QR omitido no payment GET (opt-in `includeQr=1`); order-status 3→1 request
- Smoke HTTP BFF PASS; check OK
- Próximo passo: Fase 12 (analytics) quando pedido

## 2026-10-17
### Master UI — Fase 10 Idempotency-Key create Pix
- `payment-idempotency.service.ts` + header `Idempotency-Key` em POST create
- Replay → mesma resposta + `Idempotent-Replay`; conflito → 409
- Checkout envia UUID por tentativa; factory trata gateway placeholder como demo
- Smoke HTTP webhook + create OK
- Próximo passo: Fase 11 (BFF) quando pedido

## 2026-10-17
### Master UI — Fase 9 Factory/Strategy + webhook idempotência
- Pix ingressos: Factory (`demo`|`gateway`) + Strategies; facade `createTicketPix` preservada
- Webhook tickets: claim por `eventId` ou `txn:id:status`; replay retorna `duplicate: true`
- Smoke factory + idempotency OK; contratos Pix/carrinho/hold intocados
- Próximo passo: smoke webhook → Fase 10 (Idempotency-Key)

## 2026-10-17
### Master UI — Fase 8 Selection controls & hit targets 44px
- Utilitários CSS + `hit-target.ts`; steppers, chips, filtros, CompactContextBar, sidebar remove, steps/inputs checkout ≥44px
- Atualiza STATUS-GERAL, HANDOFF-ATUAL, CHECKPOINT-ATUAL e onboarding
- Próximo passo: smoke touch → Fase 9

## 2026-10-17
### Master UI — Fase 7 Zeigarnik + Goal Gradient
- Criado `GoalProgressBar` (stages cart→pagamento, fill acelerado, copy de tarefa incompleta)
- Integrado no checkout (hero + sidebar), CartStickyBar e nudge do CTA Pix
- Atualiza STATUS-GERAL, HANDOFF-ATUAL, CHECKPOINT-ATUAL e onboarding
- Próximo passo: smoke visual → Fase 8 (hit targets 44px)

## 2026-10-17
### Master UI — Fase 6 Laws of UX + Loopdesk
- Squint/Von Restorff: CTA Pix protagonista no checkout; outras formas em progressive disclosure
- HoldTimerBanner compact na sidebar + sticky mobile; mute do CTA da sidebar no step pagamento
- Hick: QuickDecision colapsável; filtros “Mais”; acordeão exclusivo de parques
- Atualiza STATUS-GERAL, HANDOFF-ATUAL, CHECKPOINT-ATUAL e onboarding
- Próximo passo: smoke visual → Fase 7

## 2026-10-17
### Master UI — Fase 5 Atomic lock & hold timer
- Criado `server/services/ticket-hold.service.ts` (hold atômico in-memory, TTL 15 min, estoque soft)
- Rotas: `/api/tickets/holds`, `/api/tickets/availability`; integração em create/cancel/status/webhook Pix
- Frontend: `useTicketHold` + `HoldTimerBanner` no checkout; analytics `ticket_hold_*`
- Smoke test: `server/services/ticket-hold.service.test.ts`
- Atualiza STATUS-GERAL, HANDOFF-ATUAL, CHECKPOINT-ATUAL e `rsv-ui-onboarding.mdc`
- Próximo passo: validar UI do banner → Fase 6 (Laws of UX)

## 2026-03-31
### Task 11 — Pipeline CI com check/build/e2e
- Criado `.github/workflows/ci-e2e.yml` com pipeline completo
- Triggers: push main, pull_request main
- Steps: checkout, setup Node 20, npm ci, playwright install, check, build, e2e
- Upload de relatório Playwright como artefato (30 dias retenção)
- Criado README.md com badge CI e documentação básica
- Validação: PR #8 merged com sucesso
- Commit: 321b692 — Merge pull request #8
- Branch: main

## 2026-03-31
### Task 10 — E2E tests para fluxo de pedidos
- Instalado Playwright com Chromium browser
- Configurado `playwright.config.ts` com webServer e cross-env para Windows
- Criado `tests/e2e/orders-flow.spec.ts` com 3 cenários:
  - PENDING → APPROVED (voucher display)
  - FAILED → retry (carrinho restaurado + prefill buyer data)
  - EXPIRED → retry contextual
- Estabilizados seletores com `data-testid` (input-email, input-firstName, etc.)
- Corrigida navegação checkout `/ingressos-checkout` → `/ingressos/checkout`
- Validação: npm run e2e 3/3 passando
- Commit: cbb9864 — test(orders): adiciona e estabiliza fluxo e2e de pedidos
- Branch: test/orders-e2e-flow

## 2026-03-31
### Task 9 — Pré-preencher dados do comprador no retry
- Adicionada `CheckoutCustomerPrefill` type e funções `setCheckoutPrefill()`, `getCheckoutPrefill()`, `clearCheckoutPrefill()` em cart-store.ts
- Atualizado backend `/api/orders/:id` para expor phone e cpf no customer object
- Implementada lógica de prefill em ingressos.tsx (busca dados via `/api/orders/:id` e armazena)
- Pré-preenchimento automático em ingressos-checkout.tsx (campos firstName, lastName, email, phone, cpf)
- Limpeza de prefill após criação de pagamento para evitar persistência
- Validação: npm run check OK, npm run build OK
- Commit: f17e053 — feat(orders): preenche dados do comprador no retry de pedidos
- Branch: main

## 2026-03-31
### Task 8 — Restaurar carrinho do pedido anterior no retry
- Adicionada função `replaceCart()` em cart-store.ts com deduplicação e event dispatch
- Atualizado order-status.tsx com `&restore=1` no query string para EXPIRED/FAILED
- Implementada lógica de restore em ingressos.tsx com 3 states (loading, done, error)
- Adicionado banner contextual com 4 estados (loading, sucesso, erro, info)
- Adicionados ícones AlertCircle e Loader2 ao imports de ingressos.tsx
- Validação: npm run check OK, npm run build OK
- Commit: 7e58d35 — feat(orders): restaura carrinho no retry de pedidos
- Branch: feat/orders-retry-context

## 2026-03-29
- Correção de exports de tipos em componentes UI
- Ajuste de tipagem em SectionContainer
- Ajuste de integração em promocoes.tsx com FilterChips
- Correção da chamada de createSplitPaymentPix
- Validação concluída com npm run check e npm run build