import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getSupabaseServerClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/serverClient"

export type ExportStorageHealthResult = {
  bucket: string
  cleanupIssue?: string | null
  cleanupOk?: boolean
  issue?: string
  ok: boolean
  path?: string
  publicFetchStatus?: number | string
  publicUrlWorks?: boolean
  serviceRoleConfigured: boolean
  step: "config" | "list-buckets" | "bucket" | "create-bucket" | "public-bucket" | "upload" | "public-read" | "complete" | "unexpected"
}

export async function checkExportStorageHealth(): Promise<ExportStorageHealthResult> {
  const bucket = exportStorageBucketName()
  const serviceRoleConfigured = isSupabaseServiceRoleConfigured()
  const supabase = getSupabaseServerClient()

  if (!supabase) {
    return {
      bucket,
      issue: "Missing Supabase URL or key.",
      ok: false,
      serviceRoleConfigured,
      step: "config",
    }
  }

  try {
    const bucketReady = serviceRoleConfigured
      ? await ensureBucket({
          bucket,
          serviceRoleConfigured,
          supabase,
        })
      : {
          bucket,
          ok: true,
          serviceRoleConfigured,
          step: "complete" as const,
        }

    if (!bucketReady.ok) {
      return bucketReady
    }

    const objectPath = `healthcheck/${Date.now()}-kit-factory-storage-test.txt`
    const upload = await supabase.storage.from(bucket).upload(
      objectPath,
      Buffer.from("Kit Factory storage health check. Delete me if found."),
      {
        contentType: "text/plain",
        upsert: false,
      }
    )

    if (upload.error) {
      return {
        bucket,
        issue: upload.error.message,
        ok: false,
        serviceRoleConfigured,
        step: "upload",
      }
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(upload.data.path).data.publicUrl
    const publicLink = await checkPublicUrl(publicUrl)
    const cleanup = await supabase.storage.from(bucket).remove([upload.data.path])

    return {
      bucket,
      cleanupIssue: cleanup.error?.message || null,
      cleanupOk: !cleanup.error,
      ok: publicLink.ok,
      path: upload.data.path,
      publicFetchStatus: publicLink.status,
      publicUrlWorks: publicLink.ok,
      serviceRoleConfigured,
      step: publicLink.ok ? "complete" : "public-read",
    }
  } catch (error) {
    return {
      bucket,
      issue: error instanceof Error ? error.message : "Storage check failed.",
      ok: false,
      serviceRoleConfigured,
      step: "unexpected",
    }
  }
}

async function ensureBucket({
  bucket,
  serviceRoleConfigured,
  supabase,
}: {
  bucket: string
  serviceRoleConfigured: boolean
  supabase: SupabaseClient
}): Promise<ExportStorageHealthResult> {
  const buckets = await supabase.storage.listBuckets()

  if (buckets.error) {
    return {
      bucket,
      issue: buckets.error.message,
      ok: false,
      serviceRoleConfigured,
      step: "list-buckets",
    }
  }

  const existingBucket = buckets.data.find((item) => item.name === bucket)

  if (!existingBucket) {
    if (!serviceRoleConfigured) {
      return {
        bucket,
        issue:
          "Bucket not found. Run docs/supabase-storage-policies.sql in Supabase SQL Editor or add SUPABASE_SERVICE_ROLE_KEY locally so this check can create it.",
        ok: false,
        serviceRoleConfigured,
        step: "bucket",
      }
    }

    const created = await supabase.storage.createBucket(bucket, {
      public: true,
    })

    if (created.error) {
      return {
        bucket,
        issue: created.error.message,
        ok: false,
        serviceRoleConfigured,
        step: "create-bucket",
      }
    }

    return {
      bucket,
      ok: true,
      serviceRoleConfigured,
      step: "complete",
    }
  }

  if (existingBucket.public === false) {
    if (!serviceRoleConfigured) {
      return {
        bucket,
        issue:
          "Bucket exists but is not public. Make it public in Supabase or add SUPABASE_SERVICE_ROLE_KEY locally so this check can update it.",
        ok: false,
        serviceRoleConfigured,
        step: "public-bucket",
      }
    }

    const updated = await supabase.storage.updateBucket(bucket, {
      public: true,
    })

    if (updated.error) {
      return {
        bucket,
        issue: updated.error.message,
        ok: false,
        serviceRoleConfigured,
        step: "public-bucket",
      }
    }
  }

  return {
    bucket,
    ok: true,
    serviceRoleConfigured,
    step: "complete",
  }
}

async function checkPublicUrl(publicUrl: string) {
  if (!publicUrl) {
    return {
      ok: false,
      status: "missing-url",
    }
  }

  try {
    const response = await fetch(publicUrl)

    return {
      ok: response.ok,
      status: response.status,
    }
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error ? error.message : "fetch failed",
    }
  }
}

function exportStorageBucketName() {
  return process.env.SUPABASE_EXPORT_BUCKET || process.env.VITE_SUPABASE_EXPORT_BUCKET || "kit-exports"
}
