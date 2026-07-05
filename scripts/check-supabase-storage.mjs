import fs from "node:fs"
import path from "node:path"
import process from "node:process"

import { createClient } from "@supabase/supabase-js"

const env = {
  ...readEnvFile(path.join(process.cwd(), ".env")),
  ...process.env,
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ""
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ""
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabaseKey = serviceRoleKey || anonKey
const bucket = env.SUPABASE_EXPORT_BUCKET || env.VITE_SUPABASE_EXPORT_BUCKET || "kit-exports"

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    fail({
      bucket,
      issue: "Missing Supabase URL or key.",
      ok: false,
      step: "config",
    })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  })

  const bucketReady = await ensureBucket(supabase)

  if (!bucketReady) {
    return
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
    fail({
      bucket,
      issue: upload.error.message,
      ok: false,
      step: "upload",
    })
    return
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(upload.data.path).data.publicUrl
  const publicLink = await checkPublicUrl(publicUrl)
  const cleanup = await supabase.storage.from(bucket).remove([upload.data.path])

  const result = {
    bucket,
    cleanupOk: !cleanup.error,
    cleanupIssue: cleanup.error?.message || null,
    ok: publicLink.ok,
    path: upload.data.path,
    publicFetchStatus: publicLink.status,
    publicUrlWorks: publicLink.ok,
    step: publicLink.ok ? "complete" : "public-read",
  }

  if (!publicLink.ok) {
    fail(result)
    return
  }

  console.log(JSON.stringify(result, null, 2))
}

async function ensureBucket(supabase) {
  const buckets = await supabase.storage.listBuckets()

  if (buckets.error) {
    fail({
      bucket,
      issue: buckets.error.message,
      ok: false,
      step: "list-buckets",
    })
    return false
  }

  const existingBucket = buckets.data.find((item) => item.name === bucket)

  if (!existingBucket) {
    if (!serviceRoleKey) {
      fail({
        bucket,
        issue:
          "Bucket not found. Run docs/supabase-storage-policies.sql in Supabase SQL Editor or add SUPABASE_SERVICE_ROLE_KEY locally so this check can create it.",
        ok: false,
        step: "bucket",
      })
      return false
    }

    const created = await supabase.storage.createBucket(bucket, {
      public: true,
    })

    if (created.error) {
      fail({
        bucket,
        issue: created.error.message,
        ok: false,
        step: "create-bucket",
      })
      return false
    }

    return true
  }

  if (existingBucket.public === false && serviceRoleKey) {
    const updated = await supabase.storage.updateBucket(bucket, {
      public: true,
    })

    if (updated.error) {
      fail({
        bucket,
        issue: updated.error.message,
        ok: false,
        step: "public-bucket",
      })
      return false
    }
  }

  return true
}

async function checkPublicUrl(publicUrl) {
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

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {}
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((rawLine) => rawLine.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=")

        if (separator === -1) {
          return null
        }

        const key = line.slice(0, separator).trim()
        const value = stripQuotes(line.slice(separator + 1).trim())

        return [key, value]
      })
      .filter(Boolean)
  )
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function fail(result) {
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = 1
}

main().catch((error) => {
  fail({
    bucket,
    issue: error instanceof Error ? error.message : "Storage check failed.",
    ok: false,
    step: "unexpected",
  })
})
