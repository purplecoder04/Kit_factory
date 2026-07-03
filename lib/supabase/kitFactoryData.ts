import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseServerClient } from "@/lib/supabase/serverClient"
import type { KitPage, ParsedKit } from "@/lib/parser/pageTypes"

type UnknownRow = Record<string, unknown>

type DbResult<T> = {
  data: T | null
  error: PostgrestError | Error | null
}

type SyncedKit = {
  kitId: string | null
  documentId: string | null
}

type ExportKind = "pdf" | "fillable" | "mockup" | "zip"

const missingColumnPattern = /column ['"]?([^'"\s]+)['"]?/i

export async function syncParsedKitToSupabase({
  existingKitId,
  kit,
  sourceMarkdown,
}: {
  existingKitId?: string | null
  kit: ParsedKit
  sourceMarkdown: string
}): Promise<SyncedKit> {
  return withSupabaseTimeout(
    syncParsedKitToSupabaseNow({ existingKitId, kit, sourceMarkdown }),
    6_000,
    { kitId: existingKitId ?? null, documentId: null },
    "syncParsedKitToSupabase"
  )
}

async function syncParsedKitToSupabaseNow({
  existingKitId,
  kit,
  sourceMarkdown,
}: {
  existingKitId?: string | null
  kit: ParsedKit
  sourceMarkdown: string
}): Promise<SyncedKit> {
  const supabase = getSupabaseServerClient()

  if (!supabase) {
    return { kitId: existingKitId ?? null, documentId: null }
  }

  try {
    const branchId = await resolveReferenceId(supabase, "branches", kit.branch)
    const designPresetId = await resolveReferenceId(
      supabase,
      "design_presets",
      kit.designPreset
    )
    const kitId = await createOrUpdateKit({
      branchId,
      designPresetId,
      existingKitId,
      kit,
      sourceMarkdown,
      supabase,
    })

    if (!kitId) {
      return { kitId: existingKitId ?? null, documentId: null }
    }

    await createKitVersion({ kit, kitId, sourceMarkdown, supabase })
    await clearParsedKitChildren({ kitId, supabase })
    const documentId = await createKitDocument({ kit, kitId, sourceMarkdown, supabase })
    const pageRows = documentId
      ? await createKitPages({ documentId, kit, kitId, supabase })
      : []
    await createAssetRows({ documentId, kit, kitId, pages: pageRows, supabase })

    return { kitId, documentId }
  } catch (error) {
    logSupabaseDataWarning("syncParsedKitToSupabase", error)
    return { kitId: existingKitId ?? null, documentId: null }
  }
}

export async function startExportJob({
  exportKind,
  kitId,
  target,
}: {
  exportKind: ExportKind
  kitId?: string | null
  target?: string
}) {
  return withSupabaseTimeout(
    startExportJobNow({ exportKind, kitId, target }),
    2_000,
    null,
    "startExportJob"
  )
}

async function startExportJobNow({
  exportKind,
  kitId,
  target,
}: {
  exportKind: ExportKind
  kitId?: string | null
  target?: string
}) {
  const supabase = getSupabaseServerClient()

  if (!supabase || !kitId) {
    return null
  }

  const { data, error } = await insertRow<{ id?: string }>(
    supabase,
    "export_jobs",
    {
      kit_id: kitId,
      export_type: exportKind,
      type: exportKind,
      target,
      status: "running",
      started_at: new Date().toISOString(),
    },
    "id"
  )

  if (error) {
    logSupabaseDataWarning("startExportJob", error)
    return null
  }

  return data?.id ?? null
}

export async function finishExportJob({
  byteSize,
  contentType,
  exportKind,
  filename,
  jobId,
  kitId,
  target,
}: {
  byteSize: number
  contentType: string
  exportKind: ExportKind
  filename: string
  jobId?: string | null
  kitId?: string | null
  target?: string
}) {
  return withSupabaseTimeout(
    finishExportJobNow({
      byteSize,
      contentType,
      exportKind,
      filename,
      jobId,
      kitId,
      target,
    }),
    2_000,
    null,
    "finishExportJob"
  )
}

async function finishExportJobNow({
  byteSize,
  contentType,
  exportKind,
  filename,
  jobId,
  kitId,
  target,
}: {
  byteSize: number
  contentType: string
  exportKind: ExportKind
  filename: string
  jobId?: string | null
  kitId?: string | null
  target?: string
}) {
  const supabase = getSupabaseServerClient()

  if (!supabase || !jobId) {
    return null
  }

  await updateRow(
    supabase,
    "export_jobs",
    {
      completed_at: new Date().toISOString(),
      file_name: filename,
      filename,
      status: "completed",
      byte_size: byteSize,
      file_size: byteSize,
    },
    "id",
    jobId
  )

  const exportUrl = `kit-factory-download://${filename}`
  const { data, error } = await insertRow<{ id?: string }>(
    supabase,
    "export_files",
    {
      kit_id: kitId,
      export_job_id: jobId,
      job_id: jobId,
      export_type: exportKind,
      type: exportKind,
      target,
      filename,
      file_name: filename,
      content_type: contentType,
      byte_size: byteSize,
      file_size: byteSize,
      export_url: exportUrl,
      url: exportUrl,
      status: "ready",
    },
    "id"
  )

  if (error) {
    logSupabaseDataWarning("finishExportJob.export_files", error)
    return null
  }

  return data?.id ?? null
}

export async function failExportJob({
  errorMessage,
  jobId,
}: {
  errorMessage: string
  jobId?: string | null
}) {
  await withSupabaseTimeout(
    failExportJobNow({ errorMessage, jobId }),
    2_000,
    undefined,
    "failExportJob"
  )
}

async function failExportJobNow({
  errorMessage,
  jobId,
}: {
  errorMessage: string
  jobId?: string | null
}) {
  const supabase = getSupabaseServerClient()

  if (!supabase || !jobId) {
    return
  }

  const { error } = await updateRow(
    supabase,
    "export_jobs",
    {
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      status: "failed",
    },
    "id",
    jobId
  )

  if (error) {
    logSupabaseDataWarning("failExportJob", error)
  }
}

export async function markKitReadyToSell(kitId: string) {
  return withSupabaseTimeout(
    markKitReadyToSellNow(kitId),
    6_000,
    { productId: null },
    "markKitReadyToSell"
  )
}

async function markKitReadyToSellNow(kitId: string) {
  const supabase = getSupabaseServerClient()

  if (!supabase) {
    return { productId: null }
  }

  const { data: kit, error: kitError } = await supabase
    .from("kits")
    .select("*")
    .eq("id", kitId)
    .maybeSingle()

  if (kitError || !kit) {
    if (kitError) {
      logSupabaseDataWarning("markKitReadyToSell.kit", kitError)
    }

    return { productId: null }
  }

  const exportUrl = await findLatestExportUrl(supabase, kitId)
  const branch = await resolveReferenceSlug(supabase, "branches", stringValue(kit.branch_id))
  const { data: product, error: productError } = await insertRow<{ id?: string }>(
    supabase,
    "products",
    {
      name: stringValue(kit.name) || stringValue(kit.title) || "Untitled Kit",
      branch: branch || stringValue(kit.branch) || stringValue(kit.branch_id),
      type: stringValue(kit.product_type) || "workbook",
      status: "live",
      created_from: "kit_factory",
      export_url: exportUrl,
    },
    "id"
  )

  if (productError || !product?.id) {
    if (productError) {
      logSupabaseDataWarning("markKitReadyToSell.products", productError)
    }

    return { productId: null }
  }

  const { error: updateError } = await updateRow(
    supabase,
    "kits",
    {
      product_id: product.id,
      status: "ready_to_sell",
    },
    "id",
    kitId
  )

  if (updateError) {
    logSupabaseDataWarning("markKitReadyToSell.kits", updateError)
  }

  return { productId: product.id }
}

async function createOrUpdateKit({
  branchId,
  designPresetId,
  existingKitId,
  kit,
  sourceMarkdown,
  supabase,
}: {
  branchId: string | null
  designPresetId: string | null
  existingKitId?: string | null
  kit: ParsedKit
  sourceMarkdown: string
  supabase: SupabaseClient
}) {
  const row = {
    name: kit.title || "Untitled Kit",
    title: kit.title || "Untitled Kit",
    slug: kit.slug,
    branch_id: branchId,
    branch: kit.branch,
    design_preset_id: designPresetId,
    design_preset: kit.designPreset,
    product_type: kit.productType,
    output_mode: kit.outputMode,
    source_markdown: sourceMarkdown,
    status: "draft",
  }

  if (existingKitId) {
    const { error } = await updateRow(supabase, "kits", row, "id", existingKitId)

    if (!error) {
      return existingKitId
    }

    logSupabaseDataWarning("createOrUpdateKit.update", error)
  }

  const { data, error } = await insertRow<{ id?: string }>(supabase, "kits", row, "id")

  if (error) {
    logSupabaseDataWarning("createOrUpdateKit.insert", error)
    return null
  }

  return data?.id ?? null
}

async function createKitVersion({
  kit,
  kitId,
  sourceMarkdown,
  supabase,
}: {
  kit: ParsedKit
  kitId: string
  sourceMarkdown: string
  supabase: SupabaseClient
}) {
  const versionNumber = await nextVersionNumber(supabase, kitId)
  const { error } = await insertRow(
    supabase,
    "kit_versions",
    {
      kit_id: kitId,
      version_number: versionNumber,
      source_markdown: sourceMarkdown,
      parsed_snapshot: kit,
      status: "draft",
    },
    "id"
  )

  if (error) {
    logSupabaseDataWarning("createKitVersion", error)
  }
}

async function createKitDocument({
  kit,
  kitId,
  sourceMarkdown,
  supabase,
}: {
  kit: ParsedKit
  kitId: string
  sourceMarkdown: string
  supabase: SupabaseClient
}) {
  const { data, error } = await insertRow<{ id?: string }>(
    supabase,
    "kit_documents",
    {
      kit_id: kitId,
      title: kit.title || "Complete Kit",
      name: kit.title || "Complete Kit",
      document_type: "source",
      type: "source",
      source_markdown: sourceMarkdown,
      sort_order: 0,
    },
    "id"
  )

  if (error) {
    logSupabaseDataWarning("createKitDocument", error)
    return null
  }

  return data?.id ?? null
}

async function createKitPages({
  documentId,
  kit,
  kitId,
  supabase,
}: {
  documentId: string
  kit: ParsedKit
  kitId: string
  supabase: SupabaseClient
}) {
  const pageRows = kit.pages.map((page, index) => ({
    kit_id: kitId,
    kit_document_id: documentId,
    document_id: documentId,
    page_index: index + 1,
    sort_order: index + 1,
    page_type: page.type,
    type: page.type,
    section: page.section,
    title: page.title || page.rawType,
    subtitle: page.subtitle,
    content: page,
    fillable: page.fillable,
    raw_markdown: page.raw,
  }))

  const { data, error } = await insertRows<{ id?: string; page_index?: number }>(
    supabase,
    "kit_pages",
    pageRows,
    "id,page_index"
  )

  if (error) {
    logSupabaseDataWarning("createKitPages", error)
    return []
  }

  return data ?? []
}

async function createAssetRows({
  documentId,
  kit,
  kitId,
  pages,
  supabase,
}: {
  documentId: string | null
  kit: ParsedKit
  kitId: string
  pages: { id?: string; page_index?: number }[]
  supabase: SupabaseClient
}) {
  const pageIdByIndex = new Map(
    pages
      .filter((page) => page.id && page.page_index)
      .map((page) => [page.page_index as number, page.id as string])
  )
  const assetRows = kit.pages.flatMap((page, index) =>
    assetRowsForPage({
      documentId,
      kitId,
      page,
      pageId: pageIdByIndex.get(index + 1) ?? null,
      pageIndex: index + 1,
    })
  )

  if (assetRows.length === 0) {
    return
  }

  const { error } = await insertRows(supabase, "assets", assetRows, "id")

  if (error) {
    logSupabaseDataWarning("createAssetRows", error)
  }
}

function assetRowsForPage({
  documentId,
  kitId,
  page,
  pageId,
  pageIndex,
}: {
  documentId: string | null
  kitId: string
  page: KitPage
  pageId: string | null
  pageIndex: number
}) {
  const rows: UnknownRow[] = []

  if (page.imageSlot) {
    rows.push({
      kit_id: kitId,
      kit_document_id: documentId,
      document_id: documentId,
      kit_page_id: pageId,
      page_id: pageId,
      page_index: pageIndex,
      asset_type: "image_slot",
      type: "image_slot",
      name: page.imageSlot,
      key: page.imageSlot,
      status: "referenced",
    })
  }

  if (page.icon) {
    rows.push({
      kit_id: kitId,
      kit_document_id: documentId,
      document_id: documentId,
      kit_page_id: pageId,
      page_id: pageId,
      page_index: pageIndex,
      asset_type: "icon",
      type: "icon",
      name: page.icon,
      key: page.icon,
      status: "referenced",
    })
  }

  return rows
}

async function clearParsedKitChildren({
  kitId,
  supabase,
}: {
  kitId: string
  supabase: SupabaseClient
}) {
  await deleteRows(supabase, "assets", "kit_id", kitId)
  await deleteRows(supabase, "kit_pages", "kit_id", kitId)
  await deleteRows(supabase, "kit_documents", "kit_id", kitId)
}

async function nextVersionNumber(supabase: SupabaseClient, kitId: string) {
  const { data, error } = await supabase
    .from("kit_versions")
    .select("version_number")
    .eq("kit_id", kitId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data || typeof data.version_number !== "number") {
    return 1
  }

  return data.version_number + 1
}

async function findLatestExportUrl(supabase: SupabaseClient, kitId: string) {
  const { data, error } = await supabase
    .from("export_files")
    .select("export_url,url")
    .eq("kit_id", kitId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return ""
  }

  return stringValue(data.export_url) || stringValue(data.url)
}

async function resolveReferenceId(
  supabase: SupabaseClient,
  table: "branches" | "design_presets",
  value: string
) {
  const matchValue = value.trim()

  if (!matchValue) {
    return null
  }

  for (const column of ["slug", "key", "name"]) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq(column, matchValue)
      .maybeSingle()

    if (!error && data?.id) {
      return stringValue(data.id)
    }
  }

  return null
}

async function resolveReferenceSlug(
  supabase: SupabaseClient,
  table: "branches" | "design_presets",
  id: string
) {
  if (!id) {
    return ""
  }

  const { data, error } = await supabase
    .from(table)
    .select("slug,key,name")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return ""
  }

  return stringValue(data.slug) || stringValue(data.key) || stringValue(data.name)
}

async function insertRow<T>(
  supabase: SupabaseClient,
  table: string,
  row: UnknownRow,
  select = "*"
): Promise<DbResult<T>> {
  let currentRow = pruneEmptyValues(row)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from(table)
      .insert(currentRow)
      .select(select)
      .single()

    if (!error) {
      return { data: data as T, error: null }
    }

    const missingColumn = missingColumnFromError(error)

    if (!missingColumn || !Object.hasOwn(currentRow, missingColumn)) {
      return { data: null, error }
    }

    currentRow = withoutKey(currentRow, missingColumn)
  }

  return { data: null, error: new Error(`Could not insert into ${table}.`) }
}

async function insertRows<T>(
  supabase: SupabaseClient,
  table: string,
  rows: UnknownRow[],
  select = "*"
): Promise<DbResult<T[]>> {
  let currentRows = rows.map(pruneEmptyValues)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const query = supabase.from(table).insert(currentRows).select(select)
    const { data, error } = await query

    if (!error) {
      return { data: data as T[], error: null }
    }

    const missingColumn = missingColumnFromError(error)

    if (!missingColumn || !rowsHaveColumn(currentRows, missingColumn)) {
      return { data: null, error }
    }

    currentRows = currentRows.map((row) => withoutKey(row, missingColumn))
  }

  return { data: null, error: new Error(`Could not insert into ${table}.`) }
}

async function updateRow(
  supabase: SupabaseClient,
  table: string,
  row: UnknownRow,
  matchColumn: string,
  matchValue: string
): Promise<DbResult<null>> {
  let currentRow = pruneEmptyValues(row)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabase
      .from(table)
      .update(currentRow)
      .eq(matchColumn, matchValue)

    if (!error) {
      return { data: null, error: null }
    }

    const missingColumn = missingColumnFromError(error)

    if (!missingColumn || !Object.hasOwn(currentRow, missingColumn)) {
      return { data: null, error }
    }

    currentRow = withoutKey(currentRow, missingColumn)
  }

  return { data: null, error: new Error(`Could not update ${table}.`) }
}

async function deleteRows(
  supabase: SupabaseClient,
  table: string,
  matchColumn: string,
  matchValue: string
) {
  const { error } = await supabase.from(table).delete().eq(matchColumn, matchValue)

  if (error) {
    logSupabaseDataWarning(`deleteRows.${table}`, error)
  }
}

function missingColumnFromError(error: PostgrestError) {
  const combined = [error.message, error.details, error.hint].filter(Boolean).join(" ")
  const match = combined.match(missingColumnPattern)

  return match?.[1] ?? null
}

function rowsHaveColumn(rows: UnknownRow[], column: string) {
  return rows.some((row) => Object.hasOwn(row, column))
}

function withoutKey(row: UnknownRow, key: string) {
  return Object.fromEntries(Object.entries(row).filter(([entryKey]) => entryKey !== key))
}

function pruneEmptyValues(row: UnknownRow) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== null)
  )
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

async function withSupabaseTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
  scope: string
) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const guardedPromise = promise.catch((error) => {
    logSupabaseDataWarning(scope, error)
    return fallback
  })
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      logSupabaseDataWarning(scope, new Error(`Timed out after ${timeoutMs}ms.`))
      resolve(fallback)
    }, timeoutMs)
  })

  try {
    return await Promise.race([guardedPromise, timeoutPromise])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function logSupabaseDataWarning(scope: string, error: unknown) {
  console.warn(`[kit-factory:supabase] ${scope}`, error)
}
