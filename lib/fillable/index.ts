import "server-only"

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

import { type ParsedKit } from "@/lib/parser/pageTypes"
import { type RenderTarget } from "@/lib/renderer"
import { mapFillableFields } from "@/lib/fillable/fieldMapper"

export async function addFillableFields(
  pdfBuffer: Buffer,
  kit: ParsedKit,
  target: RenderTarget
) {
  const pdf = await PDFDocument.load(pdfBuffer)
  const form = pdf.getForm()
  const pages = pdf.getPages()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fields = mapFillableFields(kit, target)

  fields.forEach((fieldSpec) => {
    const page = pages[fieldSpec.pageIndex]

    if (!page) {
      return
    }

    if (fieldSpec.kind === "checkbox") {
      const field = form.createCheckBox(fieldSpec.name)
      field.addToPage(page, {
        x: fieldSpec.x,
        y: fieldSpec.y,
        width: fieldSpec.width,
        height: fieldSpec.height,
        backgroundColor: undefined,
        borderColor: rgb(0.47, 0.64, 0.57),
        borderWidth: 1,
      })
      return
    }

    const field = form.createTextField(fieldSpec.name)
    field.disableScrolling()
    field.disableSpellChecking()

    if (fieldSpec.multiline) {
      field.enableMultiline()
    }

    field.addToPage(page, {
      x: fieldSpec.x,
      y: fieldSpec.y,
      width: fieldSpec.width,
      height: fieldSpec.height,
      borderColor: rgb(0.92, 0.86, 0.82),
      borderWidth: 0.15,
      backgroundColor: undefined,
      textColor:
        fieldSpec.textColor === "white" ? rgb(1, 0.98, 0.95) : rgb(0.2, 0.08, 0.16),
      font,
    })
    field.setFontSize(fieldSpec.fontSize ?? 10)
  })

  form.updateFieldAppearances(font)

  return Buffer.from(await pdf.save())
}
