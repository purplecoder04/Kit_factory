import { parseKitMarkdown } from "@/lib/parser"
import { hasBlockingErrors, validateKit } from "@/lib/parser/validation"
import { type ValidationIssue } from "@/lib/parser/pageTypes"
import { renderKitPdf } from "@/lib/renderer"
import { createZip } from "@/lib/zip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const packageDocuments = [
  {
    bodyKey: "lessonBookMarkdown",
    filename: "meet-at-the-heal-lesson-book.pdf",
    designPreset: "meetatheal",
  },
  {
    bodyKey: "couplesWorkbookMarkdown",
    filename: "meet-at-the-heal-couples-workbook.pdf",
    designPreset: "meetatheal",
  },
  {
    bodyKey: "riseWorkbookMarkdown",
    filename: "meet-at-the-heal-rise-individual-workbook.pdf",
    designPreset: "meetatheal-rise",
  },
  {
    bodyKey: "landWorkbookMarkdown",
    filename: "meet-at-the-heal-land-individual-workbook.pdf",
    designPreset: "meetatheal-land",
  },
] as const

export async function POST(request: Request) {
  const body = await request.json()
  const files: { filename: string; data: Buffer }[] = []
  const allIssues: ValidationIssue[] = []

  for (const document of packageDocuments) {
    const markdown = typeof body[document.bodyKey] === "string" ? body[document.bodyKey] : ""
    const kit = parseKitMarkdown(markdown, {
      branch: "meetatheal",
      designPreset: document.designPreset,
      outputMode: "all-in-one",
    })
    const issues = validateKit(kit)

    if (issues.length > 0) {
      allIssues.push(
        ...issues.map((issue) => ({
          ...issue,
          detail: issue.detail
            ? `${document.filename}: ${issue.detail}`
            : document.filename,
        }))
      )
    }

    if (hasBlockingErrors(issues)) {
      continue
    }

    files.push({
      filename: document.filename,
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
      "Content-Disposition": `attachment; filename="meet-at-the-heal-kit-package.zip"`,
    },
  })
}
