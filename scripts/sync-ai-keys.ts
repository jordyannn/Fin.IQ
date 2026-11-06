import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, pool } from "../src/server/db";
import { userProfiles, users } from "../src/server/db/schema";
import { eq, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const argKey = process.argv[2]?.trim();
  const envKey = process.env.OPENROUTER_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  const tokenToApply = argKey || envKey;

  if (!tokenToApply) {
    console.error("❌ Tidak ada token yang diberikan.");
    console.log("Penggunaan:");
    console.log("  npx tsx scripts/sync-ai-keys.ts \"sk-or-v1-YOUR_KEY\"");
    console.log("  atau isi OPENROUTER_API_KEY di .env.local lalu jalankan script ini.");
    process.exit(1);
  }

  const isOpenRouter = tokenToApply.startsWith("sk-or-");
  const provider = isOpenRouter ? "OpenRouter" : "Google Gemini";

  console.log(`Mengaplikasikan ${provider} token ke seluruh profil pengguna di database...`);

  // Update semua baris user_profiles di database
  const res = await db.update(userProfiles).set({
    geminiApiKey: tokenToApply,
    updatedAt: new Date(),
  });

  // Jika argumen diberikan, sinkronkan juga ke .env.local
  if (argKey) {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      if (isOpenRouter) {
        if (/OPENROUTER_API_KEY=.*$/.test(content)) {
          content = content.replace(/OPENROUTER_API_KEY=.*$/, `OPENROUTER_API_KEY="${tokenToApply}"`);
        } else {
          content += `\nOPENROUTER_API_KEY="${tokenToApply}"\n`;
        }
      } else {
        if (/GEMINI_API_KEY=.*$/.test(content)) {
          content = content.replace(/GEMINI_API_KEY=.*$/, `GEMINI_API_KEY="${tokenToApply}"`);
        } else {
          content += `\nGEMINI_API_KEY="${tokenToApply}"\n`;
        }
      }
      fs.writeFileSync(envPath, content, "utf-8");
      console.log("✓ .env.local berhasil diperbarui dengan token baru.");
    }
  }

  // Tampilkan daftar profil yang terupdate
  const profiles = await db
    .select({
      userId: userProfiles.userId,
      name: userProfiles.displayName,
      key: userProfiles.geminiApiKey,
    })
    .from(userProfiles);

  console.log(`\n✓ Berhasil mengaktifkan AI untuk ${profiles.length} akun pengguna:`);
  profiles.forEach((p, idx) => {
    const masked = p.key ? `${p.key.slice(0, 6)}••••${p.key.slice(-4)}` : "None";
    console.log(`  ${idx + 1}. [${p.name || "User"}] -> ${masked}`);
  });

  await pool.end();
  console.log("\nSemua akun sekarang sudah aktif dan terpasang token AI!");
}

main().catch((err) => {
  console.error("Error syncing AI keys:", err);
  process.exit(1);
});

