import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { parseKitMarkdown } from "@/lib/parser"
import {
  getSupabaseServerClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/serverClient"
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

type ExportFileData = Buffer | Uint8Array

type UploadedExportFile = {
  bucket: string
  path: string
  url: string
}

export type SavedKitSummary = {
  id: string
  name: string
  status: string
}

export type SavedKitDetail = SavedKitSummary & {
  branch: string
  designPreset: string
  outputMode: string
  productExportUrl: string
  productId: string
  productStatus: string
  sourceMarkdown: string
}

export type SavedExportFileSummary = {
  id: string
  exportJobId: string
  fileUrl: string
  fileType: string
  filename: string
  status: string
  createdAt: string
}

type ProductSummary = {
  id: string
  exportUrl: string
  name: string
  status: string
}

type ExportKind = "pdf" | "fillable" | "mockup" | "zip"

const missingColumnPatterns = [
  /find the ['"]([^'"]+)['"] column/i,
  /column ['"]?([^'"\s]+)['"]?/i,
]

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
  contentType,
  exportKind,
  fileData,
  filename,
  jobId,
  kitId,
  target,
}: {
  contentType: string
  exportKind: ExportKind
  fileData?: ExportFileData
  filename: string
  jobId?: string | null
  kitId?: string | null
  target?: string
}) {
  return withSupabaseTimeout(
    finishExportJobNow({
      contentType,
      exportKind,
      fileData,
      filename,
      jobId,
      kitId,
      target,
    }),
    15_000,
    null,
    "finishExportJob"
  )
}

async function finishExportJobNow({
  contentType,
  exportKind,
  fileData,
  filename,
  jobId,
  kitId,
  target,
}: {
  contentType: string
  exportKind: ExportKind
  fileData?: ExportFileData
  filename: string
  jobId?: string | null
  kitId?: string | null
  target?: string
}) {
  const supabase = getSupabaseServerClient()

  if (!supabase || !jobId) {
    return null
  }

  const uploadedFile = await uploadExportFile({
    contentType,
    fileData,
    filename,
    kitId,
    supabase,
  })
  const exportUrl = uploadedFile?.url ?? `kit-factory-download://${filename}`

  await updateRow(
    supabase,
    "export_jobs",
    {
      completed_at: new Date().toISOString(),
      status: "completed",
    },
    "id",
    jobId
  )

  const { data, error } = await insertRow<{ id?: string }>(
    supabase,
    "export_files",
    {
      export_job_id: jobId,
      file_type: exportFileType(exportKind, target),
      file_url: exportUrl,
    },
    "id"
  )

  if (error) {
    logSupabaseDataWarning("finishExportJob.export_files", error)
    return null
  }

  return data?.id ?? null
}

async function uploadExportFile({
  contentType,
  fileData,
  filename,
  kitId,
  supabase,
}: {
  contentType: string
  fileData?: ExportFileData
  filename: string
  kitId?: string | null
  supabase: SupabaseClient
}): Promise<UploadedExportFile | null> {
  if (!fileData) {
    return null
  }

  const bucket = exportStorageBucketName()
  await ensureExportStorageBucket({ bucket, supabase })
  const path = [
    kitId ? safeStorageSegment(kitId) : "unsaved",
    `${Date.now()}-${safeStorageSegment(filename)}`,
  ].join("/")
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileData, {
      contentType,
      upsert: true,
    })

  if (error) {
    logSupabaseDataWarning("uploadExportFile", error)
    return null
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl

  if (!publicUrl) {
    return null
  }

  return {
    bucket,
    path: data.path,
    url: publicUrl,
  }
}

async function ensureExportStorageBucket({
  bucket,
  supabase,
}: {
  bucket: string
  supabase: SupabaseClient
}) {
  if (!isSupabaseServiceRoleConfigured()) {
    return
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    logSupabaseDataWarning("ensureExportStorageBucket.listBuckets", listError)
    return
  }

  const existingBucket = buckets.find((item) => item.name === bucket)

  if (!existingBucket) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
    })

    if (error) {
      logSupabaseDataWarning("ensureExportStorageBucket.createBucket", error)
    }

    return
  }

  if ((existingBucket as { public?: boolean }).public === false) {
    const { error } = await supabase.storage.updateBucket(bucket, {
      public: true,
    })

    if (error) {
      logSupabaseDataWarning("ensureExportStorageBucket.updateBucket", error)
    }
  }
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

export async function listSavedKits() {
  const supabase = getSupabaseServerClient()

  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from("kits")
    .select("id,name,status")
    .order("id", { ascending: false })
    .limit(50)

  if (error) {
    logSupabaseDataWarning("listSavedKits", error)
    return []
  }

  return (data ?? []).map((kit): SavedKitSummary => ({
    id: stringValue(kit.id),
    name: stringValue(kit.name) || "Untitled Kit",
    status: stringValue(kit.status) || "draft",
  }))
}

export async function getSavedKit(kitId: string): Promise<SavedKitDetail | null> {
  const supabase = getSupabaseServerClient()

  if (!supabase || !kitId) {
    return null
  }

  const { data: kit, error } = await supabase
    .from("kits")
    .select("*")
    .eq("id", kitId)
    .maybeSingle()

  if (error || !kit) {
    if (error) {
      logSupabaseDataWarning("getSavedKit.kit", error)
    }

    return null
  }

  const sourceMarkdown =
    stringValue(kit.source_markdown) || (await findLatestSourceMarkdown(supabase, kitId))
  const product = await findProductById(supabase, stringValue(kit.product_id))

  return {
    id: stringValue(kit.id),
    name: stringValue(kit.name) || stringValue(kit.title) || "Untitled Kit",
    status: stringValue(kit.status) || "draft",
    branch: stringValue(kit.branch) || (await resolveReferenceSlug(supabase, "branches", stringValue(kit.branch_id))),
    designPreset:
      stringValue(kit.design_preset) ||
      (await resolveReferenceSlug(supabase, "design_presets", stringValue(kit.design_preset_id))),
    outputMode: stringValue(kit.output_mode),
    productExportUrl: product?.exportUrl ?? "",
    productId: product?.id ?? "",
    productStatus: product?.status ?? "",
    sourceMarkdown,
  }
}

export async function listKitExportFiles(kitId: string): Promise<SavedExportFileSummary[]> {
  const supabase = getSupabaseServerClient()

  if (!supabase || !kitId) {
    return []
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("export_jobs")
    .select("id,export_type,status,created_at,completed_at")
    .eq("kit_id", kitId)
    .order("created_at", { ascending: false })
    .limit(40)

  if (jobsError || !jobs?.length) {
    if (jobsError) {
      logSupabaseDataWarning("listKitExportFiles.jobs", jobsError)
    }

    return []
  }

  const jobsById = new Map(
    jobs.map((job) => [
      stringValue(job.id),
      {
        createdAt: stringValue(job.completed_at) || stringValue(job.created_at),
        exportType: stringValue(job.export_type),
        status: stringValue(job.status) || "unknown",
      },
    ])
  )
  const jobIds = Array.from(jobsById.keys()).filter(Boolean)

  if (!jobIds.length) {
    return []
  }

  const { data: files, error: filesError } = await supabase
    .from("export_files")
    .select("id,export_job_id,file_url,file_type,created_at")
    .in("export_job_id", jobIds)
    .order("created_at", { ascending: false })
    .limit(80)

  if (filesError || !files?.length) {
    if (filesError) {
      logSupabaseDataWarning("listKitExportFiles.files", filesError)
    }

    return []
  }

  return files
    .map((file): SavedExportFileSummary => {
      const exportJobId = stringValue(file.export_job_id)
      const job = jobsById.get(exportJobId)
      const fileUrl = stringValue(file.file_url)

      return {
        id: stringValue(file.id),
        exportJobId,
        fileUrl,
        fileType: stringValue(file.file_type) || job?.exportType || "export",
        filename: filenameFromExportUrl(fileUrl),
        status: job?.status || "ready",
        createdAt: stringValue(file.created_at) || job?.createdAt || "",
      }
    })
    .filter((file) => file.id && file.fileUrl)
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
  const sourceMarkdown =
    stringValue(kit.source_markdown) || (await findLatestSourceMarkdown(supabase, kitId))
  const parsedKit = sourceMarkdown ? parseKitMarkdown(sourceMarkdown) : null
  const branch =
    (await resolveReferenceSlug(supabase, "branches", stringValue(kit.branch_id))) ||
    parsedKit?.branch ||
    stringValue(kit.branch) ||
    stringValue(kit.branch_id)
  const productName =
    stringValue(kit.name) || stringValue(kit.title) || parsedKit?.title || "Untitled Kit"
  const productType = stringValue(kit.product_type) || parsedKit?.productType || "workbook"
  const linkedProduct =
    (await findProductById(supabase, stringValue(kit.product_id))) ||
    (await findExistingKitFactoryProduct(supabase, {
      branch,
      name: productName,
    }))

  if (linkedProduct) {
    await updateRow(
      supabase,
      "products",
      {
        branch,
        created_from: "kit_factory",
        export_url: exportUrl || linkedProduct.exportUrl,
        name: productName,
        status: "live",
        type: productType,
      },
      "id",
      linkedProduct.id
    )
    await updateKitProductLink(supabase, kitId, linkedProduct.id)

    return {
      exportUrl: exportUrl || linkedProduct.exportUrl,
      productId: linkedProduct.id,
      productStatus: "live",
      reusedProduct: true,
    }
  }

  const { data: product, error: productError } = await insertRow<{ id?: string }>(
    supabase,
    "products",
    {
      branch,
      created_from: "kit_factory",
      export_url: exportUrl,
      name: productName,
      status: "live",
      type: productType,
    },
    "id"
  )

  if (productError || !product?.id) {
    if (productError) {
      logSupabaseDataWarning("markKitReadyToSell.products", productError)
    }

    return { productId: null }
  }

  const updateError = await updateKitProductLink(supabase, kitId, product.id)

  if (updateError) {
    logSupabaseDataWarning("markKitReadyToSell.kits", updateError)
  }

  return {
    exportUrl,
    productId: product.id,
    productStatus: "live",
    reusedProduct: false,
  }
}

async function findProductById(supabase: SupabaseClient, productId: string) {
  if (!productId) {
    return null
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,status,export_url")
    .eq("id", productId)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      logSupabaseDataWarning("findProductById", error)
    }

    return null
  }

  return productSummaryFromRow(data)
}

async function findExistingKitFactoryProduct(
  supabase: SupabaseClient,
  {
    branch,
    name,
  }: {
    branch: string
    name: string
  }
) {
  if (!name) {
    return null
  }

  let query = supabase
    .from("products")
    .select("id,name,status,export_url")
    .eq("name", name)
    .eq("created_from", "kit_factory")
    .order("created_at", { ascending: false })
    .limit(1)

  if (branch) {
    query = query.eq("branch", branch)
  }

  const { data, error } = await query

  if (error || !data?.length) {
    if (error) {
      logSupabaseDataWarning("findExistingKitFactoryProduct", error)
    }

    return null
  }

  return productSummaryFromRow(data[0])
}

async function updateKitProductLink(
  supabase: SupabaseClient,
  kitId: string,
  productId: string
) {
  const { error } = await updateRow(
    supabase,
    "kits",
    {
      product_id: productId,
      status: "ready_to_sell",
    },
    "id",
    kitId
  )

  return error
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
    status: existingKitId ? undefined : "draft",
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

async function findLatestSourceMarkdown(supabase: SupabaseClient, kitId: string) {
  const { data, error } = await supabase
    .from("kit_versions")
    .select("source_markdown")
    .eq("kit_id", kitId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      logSupabaseDataWarning("findLatestSourceMarkdown", error)
    }

    return ""
  }

  return stringValue(data.source_markdown)
}

async function findLatestExportUrl(supabase: SupabaseClient, kitId: string) {
  const { data: jobs, error: jobsError } = await supabase
    .from("export_jobs")
    .select("id")
    .eq("kit_id", kitId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10)

  if (jobsError || !jobs?.length) {
    return ""
  }

  const jobIds = jobs.map((job) => stringValue(job.id)).filter(Boolean)

  if (!jobIds.length) {
    return ""
  }

  const { data: files, error: filesError } = await supabase
    .from("export_files")
    .select("file_url")
    .in("export_job_id", jobIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (filesError || !files) {
    return ""
  }

  return stringValue(files.file_url)
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

  for (const pattern of missingColumnPatterns) {
    const match = combined.match(pattern)

    if (match?.[1]) {
      return match[1]
    }
  }

  return null
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

function productSummaryFromRow(row: UnknownRow): ProductSummary {
  return {
    exportUrl: stringValue(row.export_url),
    id: stringValue(row.id),
    name: stringValue(row.name),
    status: stringValue(row.status),
  }
}

function exportStorageBucketName() {
  return process.env.SUPABASE_EXPORT_BUCKET || process.env.VITE_SUPABASE_EXPORT_BUCKET || "kit-exports"
}

function exportFileType(exportKind: ExportKind, target?: string) {
  return target ? `${exportKind}:${target}` : exportKind
}

function filenameFromExportUrl(fileUrl: string) {
  if (!fileUrl) {
    return "Export file"
  }

  if (fileUrl.startsWith("kit-factory-download://")) {
    return decodeURIComponent(fileUrl.replace("kit-factory-download://", ""))
  }

  try {
    const pathname = new URL(fileUrl).pathname
    const filename = pathname.split("/").filter(Boolean).at(-1)

    return filename ? decodeURIComponent(filename) : "Export file"
  } catch {
    const filename = fileUrl.split("/").filter(Boolean).at(-1)

    return filename ? decodeURIComponent(filename) : "Export file"
  }
}

function safeStorageSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "export"
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
