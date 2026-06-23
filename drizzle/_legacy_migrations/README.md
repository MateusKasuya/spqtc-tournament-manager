# Migrations históricas (pré-baseline)

Estas são as 14 migrations originais (0000–0013), mantidas **apenas como referência**.

NÃO são usadas pelo drizzle-kit (que lê só `drizzle/migrations/`) e **não replicam
do zero** — a `0008_sour_prima.sql` cria uma FK `participants.player_id` (uuid) →
`players.id` (integer), incompatível, que nunca aplicou limpo.

O schema atual vive na baseline única `drizzle/migrations/0000_baseline.sql`,
gerada do schema TS (fonte de verdade) e validada 1:1 contra produção.
