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

## Required Storage Policies

The local app uses the Supabase anon key, so the bucket needs policies that allow the app to upload and read export files.

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
