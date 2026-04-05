# SPQTC Tournament Manager — Plano de Implementação

## Stack
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Banco:** Supabase (Postgres, Auth, Realtime)
- **ORM:** Drizzle ORM
- **UI:** Tailwind CSS + shadcn/ui (New York, Zinc)
- **Deploy:** Vercel (free) + domínio customizado

---

## Database Schema (7 tabelas)

### users (espelho do auth.users via trigger)
| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid | PK, ref auth.users ON DELETE CASCADE |
| email | text | NOT NULL |
| name | text | NOT NULL |
| nickname | text | UNIQUE, nullable |
| role | text | 'admin' \| 'player', DEFAULT 'player' |
| avatar_url | text | nullable |
| created_at | timestamptz | DEFAULT now() |

### seasons
| Coluna | Tipo | Nota |
|--------|------|------|
| id | serial | PK |
| name | text | NOT NULL (ex: "Temporada 2026") |
| start_date | date | NOT NULL |
| end_date | date | nullable |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |

### tournaments
| Coluna | Tipo | Nota |
|--------|------|------|
| id | serial | PK |
| season_id | integer | FK seasons, nullable |
| name | text | NOT NULL |
| date | timestamptz | NOT NULL |
| status | text | pending \| running \| finished \| cancelled |
| buy_in_amount | integer | centavos, NOT NULL |
| rebuy_amount | integer | centavos, DEFAULT 0 |
| addon_amount | integer | centavos, DEFAULT 0 |
| initial_chips | integer | NOT NULL |
| rebuy_chips | integer | DEFAULT 0 |
| addon_chips | integer | DEFAULT 0 |
| max_rebuys | integer | DEFAULT 0 |
| allow_addon | boolean | DEFAULT false |
| prize_pool_override | integer | nullable, centavos |
| current_blind_level | integer | DEFAULT 0 |
| timer_running | boolean | DEFAULT false |
| timer_remaining_secs | integer | nullable |
| timer_started_at | timestamptz | nullable |
| created_by | uuid | FK users, NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### blind_structures
| Coluna | Tipo | Nota |
|--------|------|------|
| id | serial | PK |
| tournament_id | integer | FK tournaments CASCADE, NOT NULL |
| level | integer | NOT NULL (ordinal: 1, 2, 3...) |
| small_blind | integer | NOT NULL |
| big_blind | integer | NOT NULL |
| ante | integer | DEFAULT 0 |
| duration_minutes | integer | NOT NULL |
| is_break | boolean | DEFAULT false |

UNIQUE (tournament_id, level)

### participants
| Coluna | Tipo | Nota |
|--------|------|------|
| id | serial | PK |
| tournament_id | integer | FK tournaments CASCADE, NOT NULL |
| user_id | uuid | FK users, NOT NULL |
| buy_in_paid | boolean | DEFAULT false |
| rebuy_count | integer | DEFAULT 0 |
| addon_used | boolean | DEFAULT false |
| finish_position | integer | nullable (1 = campeão) |
| points_earned | numeric(10,2) | DEFAULT 0 |
| prize_amount | integer | centavos, DEFAULT 0 |
| eliminated_at | timestamptz | nullable |
| status | text | registered \| playing \| eliminated \| finished |
| created_at | timestamptz | DEFAULT now() |

UNIQUE (tournament_id, user_id)

### transactions
| Coluna | Tipo | Nota |
|--------|------|------|
| id | serial | PK |
| tournament_id | integer | FK tournaments CASCADE, NOT NULL |
| user_id | uuid | FK users, NOT NULL |
| type | text | buy_in \| rebuy \| addon \| prize |
| amount | integer | centavos, NOT NULL |
| created_at | timestamptz | DEFAULT now() |

### prize_structures
| Coluna | Tipo | Nota |
|--------|------|------|
| id | serial | PK |
| tournament_id | integer | FK tournaments CASCADE, NOT NULL |
| position | integer | NOT NULL |
| percentage | numeric(5,2) | NOT NULL |

UNIQUE (tournament_id, position)

### Relacionamentos
```
seasons 1───N tournaments
tournaments 1───N blind_structures
tournaments 1───N participants
tournaments 1───N transactions
tournaments 1───N prize_structures
users 1───N participants
users 1───N transactions
```

---

## Estrutura de Pastas
```
src/
├── app/
│   ├── (auth)/login, register
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── torneios/ (list, novo, [id], [id]/mesa, [id]/financeiro)
│   │   ├── ranking/
│   │   ├── jogadores/ (list, [id])
│   │   └── relatorios/
│   └── api/auth/callback/
├── components/
│   ├── ui/ (shadcn)
│   ├── layout/ (sidebar, header)
│   ├── tournament/ (forms, cards, lists)
│   ├── live-table/ (timer, blinds, controls)
│   ├── ranking/
│   └── providers/
├── db/
│   ├── schema/ (1 arquivo por tabela)
│   └── queries/ (funções reutilizáveis)
├── actions/ (server actions)
├── hooks/ (realtime hooks)
├── lib/ (supabase clients, utils, constants, validators)
├── types/
└── middleware.ts
```

---

## Fases de Implementação

| Fase | Descrição | Status |
|------|-----------|--------|
| 0 | Bootstrap + Git | ✅ Concluído |
| 0.5 | Discussão de design | ✅ Concluído |
| 1 | Auth (login, registro, roles, RLS) | ✅ Concluído |
| 2 | Torneios CRUD | ✅ Concluído |
| Extra | Players desvinculados de Auth | ✅ Concluído |
| 3 | Participantes & Financeiro | ✅ Concluído |
| 4 | Mesa ao Vivo & Timer Realtime | ✅ Concluído |
| 5 | Ranking & Estatísticas | ✅ Concluído |
| 6 | Polish & Deploy | 🔲 Pendente |

---

## Decisões Arquiteturais
1. **Dinheiro em centavos** (integers) — sem problemas de floating point
2. **Timer: estado no servidor, countdown no cliente** — grava no DB só ao pausar/avançar
3. **Server Actions** ao invés de API Routes — colocado e type-safe
4. **Drizzle para queries, Supabase JS para Auth/Realtime**
5. **UI em pt-BR, código em inglês**
