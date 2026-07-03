export function localExportUnavailableResponse(exportLabel: string) {
  return Response.json(
    {
      error: `${exportLabel} exports are local-only right now. Use the local Kit Factory app to generate final files.`,
    },
    { status: 501 }
  )
}

export function isHostedExportRuntime() {
  return process.env.VERCEL === "1"
}

export function exportFailedResponse(error: unknown, fallback: string) {
  const detail = error instanceof Error ? error.message : fallback

  return Response.json(
    {
      error: fallback,
      detail,
    },
    { status: 500 }
  )
}
