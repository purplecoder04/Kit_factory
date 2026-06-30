import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { type DesignPresetSlug, type ValidationIssue } from "@/lib/parser/pageTypes"
import { renderKitPdf } from "@/lib/renderer"
import { createZip } from "@/lib/zip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const packageDocuments: {
  filenameSuffix: string
  designPreset: DesignPresetSlug
}[] = [
  {
    filenameSuffix: "brand-complete.pdf",
    designPreset: "brand",
  },
  {
    filenameSuffix: "brand-land-complete.pdf",
    designPreset: "brand-land",
  },
]

export async function POST(request: Request) {
  const body = await request.json()
  const markdown = typeof body.markdown === "string" ? body.markdown : ""
  const files: { filename: string; data: Buffer }[] = []
  const allIssues: ValidationIssue[] = []
  let packageSlug = "brand-kit"

  for (const document of packageDocuments) {
    const kit = parseKitMarkdown(markdown, {
      branch: "brand",
      designPreset: document.designPreset,
      outputMode: "all-in-one",
    })
    const issues = validateKit(kit)
    packageSlug = kit.slug || packageSlug

    if (issues.length > 0) {
      allIssues.push(
        ...issues.map((issue) => ({
          ...issue,
          detail: issue.detail
            ? `${document.designPreset}: ${issue.detail}`
            : document.designPreset,
        }))
      )
    }

    if (hasBlockingErrors(issues)) {
      continue
    }

    files.push({
      filename: `${kit.slug}-${document.filenameSuffix}`,
      data: await renderKitPdf(kit, "complete"),
    })
  }

  if (allIssues.some((issue) => issue.level === "error")) {
    return Response.json({ issues: allIssues }, { status: 400 })
  }

  const zip = createZip(files)

  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${packageSlug}-brand-style-package.zip"`,
    },
  })
}
