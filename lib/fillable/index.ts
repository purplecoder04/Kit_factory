import "server-only"

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

import { type ParsedKit } from "@/lib/parser/pageTypes"
import { type RenderTarget } from "@/lib/renderer"
import { mapFillableFields } from "@/lib/fillable/fieldMapper"
import { type FieldSpec } from "@/lib/fillable/types"
import { getDesignPreset } from "@/tokens"

export async function addFillableFields(
  pdfBuffer: Buffer,
  kit: ParsedKit,
  target: RenderTarget,
  measuredFields?: FieldSpec[]
) {
  const pdf = await PDFDocument.load(pdfBuffer)
  const form = pdf.getForm()
  const pages = pdf.getPages()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fields = measuredFields?.length ? measuredFields : mapFillableFields(kit, target)
  const preset = getDesignPreset(kit.designPreset, kit.branch)
  const inkColor = hexToRgb(preset.ink)
  const checkboxColor = hexToRgb(preset.plum)

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
        borderColor: checkboxColor,
        borderWidth: 0.75,
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
      borderColor: undefined,
      borderWidth: 0,
      backgroundColor: undefined,
      textColor: fieldSpec.textColor === "white" ? rgb(1, 0.98, 0.95) : inkColor,
      font,
    })
    field.setFontSize(fieldSpec.fontSize ?? 10)
  })

  form.updateFieldAppearances(font)

  return Buffer.from(await pdf.save())
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "")
  const red = parseInt(clean.slice(0, 2), 16) / 255
  const green = parseInt(clean.slice(2, 4), 16) / 255
  const blue = parseInt(clean.slice(4, 6), 16) / 255

  return rgb(red, green, blue)
}
