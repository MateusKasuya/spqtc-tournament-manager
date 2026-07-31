import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const migrations = await sql`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY id
  `;
  console.log("=== drizzle.__drizzle_migrations ===");
  console.table(migrations);

  const tournamentsCols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tournaments'
    ORDER BY ordinal_position
  `;
  console.log("\n=== tournaments columns ===");
  console.table(tournamentsCols);

  const participantsCols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'participants'
    ORDER BY ordinal_position
  `;
  console.log("\n=== participants columns ===");
  console.table(participantsCols);

  const transactionsCols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
    ORDER BY ordinal_position
  `;
  console.log("\n=== transactions columns ===");
  console.table(transactionsCols);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
