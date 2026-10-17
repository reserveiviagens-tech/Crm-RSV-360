# 02-HANDOFF-ATUAL

## Trilha ativa
**Sequência integrada pós-Fase 16** — Redis oficial + hardening CRM + Smart Hub live  
Repos: `Documents/rsv360` (backend/turismo) + `Crm-RSV-360` (ingressos)

## Concluído nesta rodada
1. **Redis oficial** — container `rsv360-redis` (:6379), `REDIS_DISABLED=false`, BullMQ workers registrados, `PONG` OK; backend `:3002`
2. **Hardening CRM `/ingressos`** — CartStickyBar desktop (max-width 960), Pix sem split intacto, funil/analytics Fases 8–12 estáveis
3. **Smart Hub Plus** — KPIs/funil via APIs Turismo (`relatorios`, `financeiro`, `anfitriao`, `campanhas`) + CRM `GET /api/analytics/recent`; layout desktop `max-w-7xl` + grid 5/7

## Estado dos serviços locais
| Serviço | Porta | Notas |
|---------|-------|--------|
| CRM Vite | 5000 | `/ingressos` + analytics |
| Backend RSV360 | 3002 | Redis real + workers BullMQ |
| Turismo Next | 3005 | `/dashboard/smart-hub` |
| Postgres | 5433 | `rsv360-postgres` |
| Redis | 6379 | `rsv360-redis` alpine |

## Próximo passo exato
1. Smoke visual desktop do Smart Hub em `http://localhost:3005/dashboard/smart-hub` (badge “API ao vivo” / “Parcial”)
2. Smoke `/ingressos` — adicionar item → CartStickyBar → checkout Pix
3. Só então **Fase 15 Scrapling** — 1 fase por vez, quando pedido

## Credenciais smoke Turismo
- `admin@rsv360.local` / `admin123456789`

## Docs ops
- Redis: `Documents/rsv360/docs/ops/REDIS-LOCAL.md`
