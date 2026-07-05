import { markKitReadyToSell } from "@/lib/supabase/kitFactoryData"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: Promise<{ kitId: string }> }
) {
  const { kitId } = await context.params

  if (!kitId) {
    return Response.json({ error: "Missing kit id." }, { status: 400 })
  }

  const result = await markKitReadyToSell(kitId)

  if (!result.productId) {
    const status = result.code === "missing_public_export" ? 409 : 500

    return Response.json(
      {
        code: result.code,
        error: result.error || "The kit could not be marked ready to sell.",
      },
      { status }
    )
  }

  return Response.json(result)
}
