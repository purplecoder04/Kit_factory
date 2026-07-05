import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const sqlPath = path.join(process.cwd(), "docs", "supabase-storage-policies.sql")
    const sql = await readFile(sqlPath, "utf8")

    return Response.json({ sql })
  } catch {
    return Response.json(
      { error: "The Supabase setup SQL file could not be loaded." },
      { status: 500 }
    )
  }
}
