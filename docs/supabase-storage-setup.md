# Supabase Storage Setup

Kit Factory can save real public export links when a Supabase Storage bucket is available.

## Bucket

Create this public bucket in Supabase:

```text
kit-exports
```

The app also supports a custom bucket name through:

```text
SUPABASE_EXPORT_BUCKET=your-bucket-name
```

or:

```text
VITE_SUPABASE_EXPORT_BUCKET=your-bucket-name
```

## Server Key

The app can use the anon key for normal database reads/writes when your Supabase policies allow it. For reliable local export uploads, add this server-only key to `.env`:

```text
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not expose this key in browser code or Vercel public/client variables. It is only read by the server-side Supabase client.

When `SUPABASE_SERVICE_ROLE_KEY` is present, the app will automatically create the export bucket if it is missing and make it public so copied export links work outside the app.

## Required Storage Policies

If you do not add `SUPABASE_SERVICE_ROLE_KEY`, the local app uses the Supabase anon key, so the bucket needs policies that allow the app to upload and read export files.

Minimum policy intent:

- allow insert/upload into `storage.objects` for bucket `kit-exports`
- allow public read/select from `storage.objects` for bucket `kit-exports`

Once that is in place, PDF, fillable, mockup, Brand ZIP, and Meet at the Heal ZIP exports will upload automatically and save the public URL into `export_files.file_url`.

## Current Fallback

If the bucket or policies are missing, exports still download locally. The database keeps a local fallback URL like:

```text
kit-factory-download://filename.pdf
```

That fallback is useful inside the local workflow, but it is not a public share link.

## Health Check

Run this after creating the bucket or adding `SUPABASE_SERVICE_ROLE_KEY`:

```text
npm run storage:check
```

The check uploads a tiny temporary file, opens its public URL, then deletes the file. It prints which step failed if real public links are not ready yet.
