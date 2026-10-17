# Status Geral — RSV360

  ## Última atualização: 2026-10-17

  ## Trilha Master UI (paralela às fases de implantação)
  | Passo | Título | Status |
  |-------|--------|--------|
  | A | Leis `rsv-ui-onboarding.mdc` + `.cursorrules` | ✅ |
  | B | Fase 0 deps (`sharp`) | ✅ |
  | C | PHASE_1 CompactContextBar | ✅ |
  | D | PHASE_2 above-fold + Combo após 1º parque | ✅ |
  | E | PHASE_3 V13 grid + meia-entrada + onError | ✅ |
  | 4 | PHASE_4 Turismo Control Center (`home-sections`) | ✅ |
  | 5 | PHASE_5 Atomic lock + hold timer (ingressos) | ✅ |
  | 6 | PHASE_6 Laws of UX + Loopdesk (Squint/Hick) | ✅ |
  | 7 | PHASE_7 Zeigarnik + Goal Gradient | ✅ |
  | 8 | PHASE_8 Selection controls & hit 44px | ✅ |
  | 9 | PHASE_9 Factory/Strategy + webhook idempotência | ✅ |
  | 10 | PHASE_10 Idempotency-Key create Pix | ✅ |
  | 11 | PHASE_11 BFF & payload optimization | ✅ |
  | 12 | PHASE_12 Tracking & analytics audit | ✅ |
  | 16 | PHASE_16 Smart Dashboard V8/V13 Turismo | ✅ |
  | 16+ | Redis oficial + Smart Hub live + CartSticky desktop | ✅ |

  ## Resumo por Fase

  | Fase | Título | Status |
  |------|--------|--------|
  | 01 | Catálogo de ingressos | ✅ CONCLUÍDA |
  | 02 | Seleção de ingressos (UI) | ✅ CONCLUÍDA |
  | 03 | Checkout Pix (tickets) | ✅ CONCLUÍDA |
  | 04 | Pós-pagamento + orquestrador | ✅ CONCLUÍDA |
  | 05 | Voucher PDF + entrega | ✅ CONCLUÍDA |
  | 06 | Admin painel + métricas | ✅ CONCLUÍDA |
  | 07 | Gamificação + qualidade | ✅ CONCLUÍDA |
  | 08 | Hardening + segurança | ✅ CONCLUÍDA |

  ## Tasks de Agente

  | # | Título | Status | Notas |
  |---|--------|--------|-------|
  | 1 | Sincronizar com GitHub e atualizar docs | ✅ CONCLUÍDA | Docs atualizados, bugs path corrigidos |
  | 2 | Validar Fase-07 e fluxo completo de compra | ✅ CONCLUÍDA | Todos smoke tests passaram; GET /api/status adicionado |
  | 3 | Fase 08 — Hardening, segurança e observabilidade | ✅ CONCLUÍDA | Logger JSON, UUID+HMAC voucher, rate limit, alertas, runbook, voucherToken no fluxo frontend |
  | 4 | Filtros: substituir sidebar lateral por painel flutuante | ✅ CONCLUÍDA | Painel flutuante com backdrop em ingressos, hotéis, atrações |
  | 5 | Hotéis: navegação animada de categorias + painel Airbnb | ✅ CONCLUÍDA | HotelCategoryNav animado + painel de reserva estilo Airbnb |
  | 6 | Barra de navegação unificada (tipos + categorias + badges) | ✅ CONCLUÍDA | UnifiedCatalogNav com ícones animados e badges NOVO |
  | 7 | Padronização da barra de navegação em todas as páginas-catálogo | ✅ CONCLUÍDA | Nav unificada em ingressos, hotéis, atrações, leilões, flash-deals, promoções, excursões |
  | 8 | Caldas AI — Agente Flutuante Inteligente | ✅ CONCLUÍDA | CaldasAiFloatingAgent com botão flutuante e chat integrado |
  | 9 | UI Quick-Fixes: balloon, nav alignment, MobileCTABar | ✅ CONCLUÍDA | Balloon CTA removido, HotelCategoryNav chips flex-start, MobileCTABar retorna null |
  | 10 | Caldas AI: Wizard embutido no chat (sem Step 1 separado) | ✅ CONCLUÍDA | Chat abre direto; 6 cards de perfil inline como 1ª mensagem; botão oculto quando modal aberta |
  | 11 | Fix: TravelerProfileModal não abre automaticamente | ✅ CONCLUÍDA | Removido setTimeout que auto-abria o wizard em atracoes, hoteis, promocoes, leiloes |
  | 12 | Task 8 — Restaurar carrinho do pedido anterior no retry | ✅ CONCLUÍDA | replaceCart em cart-store; restore=1 em order-status; restore logic em ingressos; banner contextual |
  | 13 | Task 9 — Pré-preencher dados do comprador no retry | ✅ CONCLUÍDA | setCheckoutPrefill/getCheckoutPrefill em cart-store; backend expõe phone/cpf; prefill em checkout; limpeza após pagamento |
  | 14 | Task 10 — E2E tests para fluxo de pedidos | ✅ CONCLUÍDA | Playwright com 3 cenários: PENDING→APPROVED, FAILED→retry, EXPIRED→retry; carrinho restaurado + prefill buyer data |
  | 15 | Task 11 — Pipeline CI com check/build/e2e | ✅ CONCLUÍDA | GitHub Actions com check, build, e2e; upload relatório Playwright; badge CI no README |

  ## Smoke Tests Validados (Task #2)

  | Endpoint | Resultado |
  |----------|-----------|
  | GET /api/status | ✅ JSON: ok:true, service, version, uptime |
  | GET /api/weather | ✅ Caldas Novas, temp, forecast 3 dias |
  | GET /api/weather/by-coords | ✅ HIT cache após primeira fetch |
  | POST /api/payments/tickets/create | ✅ 201, transactionId, demo:true, combo:true |
  | POST /api/payments/tickets/:id/demo-confirm | ✅ 200, status:APPROVED |
  | GET /api/orders/:id/voucher | ✅ 200, %PDF-1.3, ~9KB |
  | GET /api/admin/metrics | ✅ Real data: totalOrders, paidOrders, revenue |
  | Orchestrator | ✅ Fires on PAID: log [orchestrator] |
  | WhatsApp demo | ✅ Returns {success:true, demo:true} |
  | Email (SMTP) | ⚠️ SMTP não configurado (esperado em dev) |

  ## Gate Final Fase 08 (Task #3)

  | Teste | Resultado |
  |-------|-----------|
  | GET /api/status | ✅ ok:true, queues, alerts |
  | voucherId UUID v4 | ✅ isUUID=true |
  | voucherToken HMAC-SHA256 (64 hex) | ✅ isHex64=true |
  | Voucher sem token → 401 | ✅ |
  | Voucher com token inválido → 403 | ✅ |
  | Voucher com token válido → 200 %PDF | ✅ ~9KB |
  | Rate limit voucher 10/min → 429 na req #8 | ✅ |
  | GET /api/admin/alerts | ✅ `{"alerts":[]}` |
  | Admin bypass (sessão admin sem token) | ✅ 200 |
  | VoucherDownloadCard passa ?token= no fetch | ✅ |
  | voucherToken propagado na URL sucesso | ✅ |

  ## Entregas de UX/UI (Tasks #4–#10)

  | Entregável | Arquivo | Status |
  |-----------|---------|--------|
  | Painel flutuante de filtros | `client/src/components/FilterDrawer.tsx` | ✅ |
  | HotelCategoryNav (chips animados) | `client/src/components/hotel/HotelCategoryNav.tsx` | ✅ chips flex-start |
  | Painel de reserva Airbnb-style | `client/src/pages/hoteis.tsx` | ✅ |
  | UnifiedCatalogNav (barra unificada) | `client/src/components/UnifiedCatalogNav.tsx` | ✅ |
  | Nav unificada em 7 páginas-catálogo | ingressos/hoteis/atracoes/leiloes/flash-deals/promocoes/excursoes | ✅ |
  | CaldasAiFloatingAgent | `client/src/components/caldas-ai-floating-agent.tsx` | ✅ |
  | Chat abre direto (sem Step 1 modal) | caldas-ai-floating-agent.tsx | ✅ |
  | TravelerProfileModal só por clique | atracoes/hoteis/promocoes/leiloes | ✅ |
  | MobileCTABar oculta | `client/src/components/home/MobileCTABar.tsx` | ✅ retorna null |

  ## Invariantes do projeto (NÃO alterar sem briefing)

  - **Hero azul `/ingressos`**: gradiente `#0891B2 → #2563EB` — nunca alterar
  - **Grid nunca vira lista**: catálogo de ingressos sempre em grade
  - **Combo IA nunca removido**: `server/services/recommendation.service.ts`
  - **Pix Ingresso**: sem split (`ticket-payment.service.ts`)
  - **Pix Excursão**: com split (`payment.service.ts`)
  - **Weather**: frontend nunca chama Open-Meteo diretamente — sempre via `/api/weather`
  - **data-testid** em todos os elementos interativos
  - **TravelerProfileModal**: só abre por clique explícito do usuário (nunca automático)
  - **CaldasAiFloatingAgent**: chat abre direto, sem Step 1 separado; botão oculto quando modal aberta

  ## Próximos Passos

  Para escalar em produção:
  1. Configure variáveis de ambiente reais (SMTP, Evolution API, Gateway Pix, VOUCHER_SECRET)
  2. Substitua in-memory stores por PostgreSQL persistente
  3. Configure CI/CD com typecheck + build automatizado
  4. Integre monitoramento (Sentry/Datadog) consumindo os alertas de `GET /api/admin/alerts`
