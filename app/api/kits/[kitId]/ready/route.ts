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
    return Response.json(
      { error: "The kit could not be marked ready to sell." },
      { status: 500 }
    )
  }

  return Response.json(result)
}
