"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  FolderOpenIcon,
  Layers3Icon,
  LoaderCircleIcon,
  PlayIcon,
  UploadIcon,
  WavesIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { goldenKitMarkdown } from "@/lib/goldenKit"
import { cn } from "@/lib/utils"
import type { ContentBlock, KitPage, OutputMode, ParsedKit, ValidationIssue } from "@/lib/parser/pageTypes"

type ParseResult = {
  kit: ParsedKit
  issues: ValidationIssue[]
}

type BuildStatus =
  | "Draft"
  | "Parsed"
  | "Preview Ready"
  | "PDF Generated"
  | "Fillable Generated"
  | "Error"

const savedKits = [
  { name: "GYBS Brand Kit", date: "Golden test", status: "Preview Ready" },
  { name: "Offer Clarity Kit", date: "Draft", status: "Draft" },
  { name: "Launch Reset Kit", date: "Archived", status: "PDF Generated" },
]

export function KitFactoryDashboard() {
  const [markdown, setMarkdown] = useState(goldenKitMarkdown)
  const [branch, setBranch] = useState("brand")
  const [outputMode, setOutputMode] = useState<OutputMode>("split")
  const [result, setResult] = useState<ParseResult | null>(null)
  const [status, setStatus] = useState<BuildStatus>("Draft")
  const [message, setMessage] = useState("Golden kit loaded.")
  const [isWorking, setIsWorking] = useState(false)

  const blockingErrors = useMemo(
    () => result?.issues.filter((issue) => issue.level === "error") ?? [],
    [result]
  )
  const warningIssues = useMemo(
    () => result?.issues.filter((issue) => issue.level === "warning") ?? [],
    [result]
  )
  const progressValue = useMemo(() => {
    if (status === "Draft") return 12
    if (status === "Parsed") return 34
    if (status === "Preview Ready") return 54
    if (status === "PDF Generated") return 76
    if (status === "Fillable Generated") return 100
    return 18
  }, [status])

  useEffect(() => {
    void parseMarkdown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function parseMarkdown() {
    setIsWorking(true)
    setMessage("Checking markdown.")

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown, branch, outputMode }),
      })
      const payload = (await response.json()) as ParseResult
      const hasErrors = payload.issues.some((issue) => issue.level === "error")

      setResult(payload)
      setStatus(hasErrors ? "Error" : "Preview Ready")
      setMessage(hasErrors ? "Fix the validation errors before rendering." : "Markdown parsed successfully.")
    } catch {
      setStatus("Error")
      setMessage("The markdown could not be checked.")
    } finally {
      setIsWorking(false)
    }
  }

  async function downloadOutput(kind: "render" | "fillable", targetOverride?: "guide" | "workbook" | "complete") {
    setIsWorking(true)
    setMessage(kind === "render" ? "Generating PDF." : "Generating fillable workbook.")

    const target =
      targetOverride ??
      (kind === "render"
        ? outputMode === "all-in-one"
          ? "complete"
          : "guide"
        : outputMode === "all-in-one"
          ? "complete"
          : "workbook")

    try {
      const response = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown, branch, outputMode, target }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { issues?: ValidationIssue[] }
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage("Fix the validation errors before rendering.")
        return
      }

      const blob = await response.blob()
      const filename = filenameFromResponse(response, fallbackFilename(kind, target))
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setStatus(kind === "render" ? "PDF Generated" : "Fillable Generated")
      setMessage(`${filename} downloaded.`)
    } catch {
      setStatus("Error")
      setMessage("The file could not be generated.")
    } finally {
      setIsWorking(false)
    }
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) {
      return
    }

    setMarkdown(await file.text())
    setStatus("Draft")
    setMessage(`${file.name} loaded.`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[256px_1fr]">
        <aside className="flex flex-col bg-sidebar px-4 py-5 text-sidebar-foreground lg:min-h-screen">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <WavesIcon />
            </div>
            <div>
              <div className="font-heading text-xl font-semibold leading-tight">Kit Factory</div>
              <div className="text-xs text-sidebar-foreground/70">Best Collective Brand LLC</div>
            </div>
          </div>

          <nav className="mt-8 flex flex-col gap-1 text-sm">
            {[
              ["Dashboard", Layers3Icon],
              ["New Kit", FileTextIcon],
              ["All Kits", FolderOpenIcon],
            ].map(([label, Icon]) => (
              <button
                key={label as string}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-left transition-colors",
                  label === "Dashboard"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                )}
                type="button"
              >
                <Icon />
                {label as string}
              </button>
            ))}
          </nav>

          <div className="mt-8 hidden flex-1 flex-col gap-3 lg:flex">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60">
              Saved Kits
            </div>
            {savedKits.map((kit) => (
              <div
                className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-sm"
                key={kit.name}
              >
                <div className="font-medium">{kit.name}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-sidebar-foreground/65">
                  <span>{kit.date}</span>
                  <span>{kit.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 hidden rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 lg:block">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                E
              </div>
              <div>
                <div className="text-sm font-medium">Erica</div>
                <div className="text-xs text-sidebar-foreground/65">Solo Operator</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex flex-col gap-4 border-b bg-card px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Current Kit</div>
              <h1 className="font-heading text-2xl font-semibold">
                {result?.kit.title || "Get Your Business Straight Kit"}
              </h1>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Field>
                <FieldLabel>Branch</FieldLabel>
                <Select value={branch} onValueChange={(value) => setBranch(String(value))}>
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="brand">Brand</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldTitle>Output Mode</FieldTitle>
                <ToggleGroup
                  aria-label="Output mode"
                  onValueChange={(value) => {
                    const next = value.at(-1)

                    if (next === "split" || next === "all-in-one") {
                      setOutputMode(next)
                    }
                  }}
                  size="sm"
                  spacing={1}
                  value={[outputMode]}
                  variant="outline"
                >
                  <ToggleGroupItem value="split">Split</ToggleGroupItem>
                  <ToggleGroupItem value="all-in-one">All-in-one</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              <Button disabled={isWorking} onClick={parseMarkdown}>
                {isWorking ? (
                  <LoaderCircleIcon data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                Parse
              </Button>
            </div>
          </header>

          <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
            <section className="flex min-w-0 flex-col gap-4">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Markdown Source</CardTitle>
                    <CardDescription>
                      {result?.kit.slug ? `${result.kit.slug}.md` : "kit-factory-markdown.md"}
                    </CardDescription>
                  </div>
                  <CardAction>
                    <Field>
                      <FieldLabel className="sr-only" htmlFor="markdown-upload">
                        Upload markdown
                      </FieldLabel>
                      <Input
                        accept=".md,.markdown,text/markdown,text/plain"
                        className="max-w-56"
                        id="markdown-upload"
                        onChange={(event) => handleFileUpload(event.target.files?.[0])}
                        type="file"
                      />
                    </Field>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Textarea
                    aria-label="Markdown source"
                    className="h-[360px] resize-none font-mono text-xs leading-6 xl:h-[330px]"
                    onChange={(event) => {
                      setMarkdown(event.target.value)
                      setStatus("Draft")
                    }}
                    value={markdown}
                  />
                </CardContent>
              </Card>

              <ValidationPanel
                blockingErrors={blockingErrors}
                isWorking={isWorking}
                issues={result?.issues ?? []}
                onRevalidate={parseMarkdown}
                warnings={warningIssues}
              />
            </section>

            <section className="grid min-w-0 gap-4 xl:grid-rows-[1fr_auto]">
              <PagePreview kit={result?.kit ?? null} />
              <OutputPanel
                isWorking={isWorking}
                onDownloadFillable={() => downloadOutput("fillable")}
                onDownloadPdf={() => downloadOutput("render")}
                onDownloadWorkbookPdf={() => downloadOutput("render", "workbook")}
                progressValue={progressValue}
                status={status}
              />
            </section>
          </div>

          <footer className="flex flex-col gap-2 border-t bg-card px-5 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>{message}</span>
            <span>{result?.kit.pages.length ?? 0} pages detected</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

function ValidationPanel({
  blockingErrors,
  issues,
  isWorking,
  onRevalidate,
  warnings,
}: {
  blockingErrors: ValidationIssue[]
  issues: ValidationIssue[]
  isWorking: boolean
  onRevalidate: () => void
  warnings: ValidationIssue[]
}) {
  const healthy = issues.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Validation</CardTitle>
          <Badge variant={healthy ? "secondary" : blockingErrors.length > 0 ? "destructive" : "outline"}>
            {healthy ? "All good" : `${blockingErrors.length} errors`}
          </Badge>
          {warnings.length > 0 && <Badge variant="outline">{warnings.length} warnings</Badge>}
        </div>
        <CardAction>
          <Button disabled={isWorking} onClick={onRevalidate} size="sm" variant="outline">
            {isWorking ? (
              <LoaderCircleIcon data-icon="inline-start" />
            ) : (
              <CheckCircle2Icon data-icon="inline-start" />
            )}
            Re-check
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {healthy ? (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Ready to render</AlertTitle>
            <AlertDescription>
              Frontmatter, page tags, prompts, and page length checks are passing.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[120px_1fr] border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground md:grid-cols-[140px_1fr_1fr]">
              <span>Status</span>
              <span>Check</span>
              <span className="hidden md:block">Details</span>
            </div>
            {issues.map((issue) => (
              <div
                className="grid grid-cols-[120px_1fr] gap-2 border-b px-3 py-3 text-sm last:border-b-0 md:grid-cols-[140px_1fr_1fr]"
                key={`${issue.code}-${issue.pageIndex ?? "global"}-${issue.message}`}
              >
                <span className="flex items-center gap-2">
                  {issue.level === "error" ? <AlertCircleIcon /> : <CheckCircle2Icon />}
                  {issue.level === "error" ? "Fix" : "Review"}
                </span>
                <span>{issue.message}</span>
                <span className="text-muted-foreground md:block">{issue.detail}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PagePreview({ kit }: { kit: ParsedKit | null }) {
  const pages = kit?.pages ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeIndex = pages.length > 0 ? Math.min(selectedIndex, pages.length - 1) : 0
  const selectedPage = pages[safeIndex] ?? null

  return (
    <Card className="min-h-[440px]">
      <CardHeader>
        <div>
          <CardTitle>Preview</CardTitle>
          <CardDescription>{pages.length} pages detected</CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline">US Letter</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[156px_1fr]">
          <div className="max-h-[430px] overflow-auto rounded-lg border">
            {pages.map((page, index) => (
              <button
                aria-pressed={safeIndex === index}
                className={cn(
                  "grid w-full grid-cols-[30px_1fr] gap-2 border-b p-3 text-left text-sm transition-colors last:border-b-0",
                  safeIndex === index
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-muted/65"
                )}
                data-testid={`preview-page-${index + 1}`}
                key={page.id}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <span className="text-muted-foreground">{index + 1}</span>
                <span>
                  <span className="block font-medium">{page.title || page.rawType}</span>
                  <span className="block text-xs text-muted-foreground">{page.rawType}</span>
                </span>
              </button>
            ))}
          </div>

          <MiniPagePreview kit={kit} page={selectedPage} pageNumber={safeIndex + 1} total={pages.length} />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniPagePreview({
  kit,
  page,
  pageNumber,
  total,
}: {
  kit: ParsedKit | null
  page: KitPage | null
  pageNumber: number
  total: number
}) {
  const section = page?.section || page?.rawType || kit?.branch || "brand"

  return (
    <div
      className="relative mx-auto aspect-[8.5/11] w-full max-w-[360px] overflow-hidden rounded-lg border bg-brand-paper shadow-sm"
      data-testid="selected-page-preview"
    >
      <div className="flex h-9 items-center bg-brand-plum px-5 text-[8px] font-bold uppercase tracking-[0.28em] text-white/90">
        {section}
      </div>
      <MiniPageBody kit={kit} page={page} />
      <div className="absolute bottom-5 left-7 right-7 flex justify-between border-t border-brand-line pt-3 text-[8px] text-muted-foreground">
        <span>Best Collective Brand LLC</span>
        <span>
          {total > 0 ? pageNumber : 0} / {total}
        </span>
      </div>
    </div>
  )
}

function MiniPageBody({ kit, page }: { kit: ParsedKit | null; page: KitPage | null }) {
  if (!page) {
    return (
      <div className="p-7">
        <div className="font-heading text-3xl font-semibold text-brand-plum">Kit Preview</div>
      </div>
    )
  }

  if (page.type === "cover") {
    return (
      <div className="mx-7 mt-8 rounded-lg bg-brand-plum px-7 py-9 text-center text-brand-paper">
        <div className="text-[8px] font-semibold uppercase tracking-[0.34em] text-primary">
          {page.section || "Preview"}
        </div>
        <div className="mt-4 font-heading text-3xl font-semibold leading-tight">
          {kit?.title || page.title}
        </div>
        <div className="mx-auto mt-4 h-px w-12 bg-primary" />
      </div>
    )
  }

  if (page.type === "closing") {
    return (
      <div className="p-5">
        <MiniPageHeading page={page} />
        <div className="mt-4 rounded-lg bg-brand-plum p-5 text-center text-brand-paper">
          <div className="mx-auto mb-4 size-3 rotate-45 bg-brand-paper" />
          <MiniContent blocks={page.content} compact />
        </div>
      </div>
    )
  }

  return (
    <div className="p-5">
      <MiniPageHeading page={page} />
      <MiniContent blocks={page.content} />
      <MiniFillablePreview page={page} />
    </div>
  )
}

function MiniPageHeading({ page }: { page: KitPage }) {
  return (
    <>
      <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-primary">
        {page.section || page.rawType}
      </div>
      <div className="mt-2 font-heading text-lg font-semibold leading-tight text-brand-plum">
        {page.title || page.rawType}
      </div>
    </>
  )
}

function MiniContent({ blocks, compact = false }: { blocks: ContentBlock[]; compact?: boolean }) {
  return (
    <div className={cn("mt-3 grid gap-2", compact && "mt-0 gap-2")}>
      {blocks.slice(0, compact ? 2 : 3).map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p
              className={cn(
                "line-clamp-3 text-[10px] leading-5 text-muted-foreground",
                compact && "font-heading text-base italic leading-6 text-brand-paper"
              )}
              key={`${block.type}-${index}`}
            >
              {block.text}
            </p>
          )
        }

        if (block.type === "list") {
          return (
            <ul className="ml-4 list-disc text-[10px] leading-5 text-muted-foreground" key={`${block.type}-${index}`}>
              {block.items.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        }

        if (block.type === "quote") {
          return (
            <div className="rounded-lg border-l-4 border-l-brand-plum bg-[#ece7f5] p-4" key={`${block.type}-${index}`}>
              <div className="font-heading text-lg italic leading-tight text-brand-plum">{block.text}</div>
              {block.attribution && (
                <div className="mt-3 text-[8px] font-semibold uppercase tracking-[0.22em] text-primary">
                  {block.attribution}
                </div>
              )}
            </div>
          )
        }

        if (block.type === "key-term") {
          return (
            <div className="rounded-lg border-l-4 border-l-brand-plum bg-[#ece7f5] p-4" key={`${block.type}-${index}`}>
              <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-brand-plum">Key Term</div>
              <div className="mt-2 font-heading text-xl font-semibold text-brand-plum">{block.term}</div>
              <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-muted-foreground">{block.text}</p>
            </div>
          )
        }

        return (
          <div
            className="rounded-lg border-l-4 border-l-primary bg-white/55 p-3 text-[10px] leading-5 text-brand-plum"
            key={`${block.type}-${index}`}
          >
            {block.text}
          </div>
        )
      })}
    </div>
  )
}

function MiniFillablePreview({ page }: { page: KitPage }) {
  if (page.type === "workbook") {
    return (
      <div className="mt-3 grid gap-2">
        {page.prompts.slice(0, 1).map((prompt, index) => (
          <div
            className="rounded-lg border border-brand-line border-l-4 border-l-primary bg-white/45 p-2"
            key={`${prompt}-${index}`}
          >
            <div className="font-heading text-xs italic leading-tight text-brand-plum">{prompt}</div>
            <div className="mt-2 grid gap-1.5">
              <span className="h-px bg-brand-line" />
              <span className="h-px bg-brand-line" />
              <span className="h-px bg-brand-line" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "checklist") {
    return (
      <div className="mt-3 grid gap-2">
        {page.prompts.slice(0, 5).map((prompt, index) => (
          <div
            className="grid grid-cols-[14px_1fr] gap-2 border-b border-brand-line pb-2 text-[10px]"
            key={`${prompt}-${index}`}
          >
            <span className="mt-0.5 size-3 rounded-sm border border-[#d3c5eb]" />
            <span className="line-clamp-1">{prompt}</span>
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "tracker") {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-brand-line text-[8px]">
        <div className="grid grid-cols-4 bg-[#ece7f5] font-semibold uppercase tracking-[0.16em] text-brand-plum">
          <span className="p-2">Step</span>
          <span className="p-2">Owner</span>
          <span className="p-2">Status</span>
          <span className="p-2">Notes</span>
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="grid grid-cols-4 border-t border-brand-line" key={index}>
            <span className="h-8 border-r border-brand-line" />
            <span className="h-8 border-r border-brand-line" />
            <span className="h-8 border-r border-brand-line" />
            <span className="h-8" />
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "reflection") {
    return (
      <div className="mt-3 grid gap-2">
        {page.prompts.slice(0, 2).map((prompt, index) => (
          <div className="rounded-lg bg-brand-plum p-3 text-brand-paper" key={`${prompt}-${index}`}>
            <div className="font-heading text-xs italic leading-tight">{prompt}</div>
            <div className="mt-2 grid gap-1.5">
              <span className="h-px bg-white/45" />
              <span className="h-px bg-white/45" />
              <span className="h-px bg-white/45" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return null
}

function OutputPanel({
  isWorking,
  onDownloadFillable,
  onDownloadPdf,
  onDownloadWorkbookPdf,
  progressValue,
  status,
}: {
  isWorking: boolean
  onDownloadFillable: () => void
  onDownloadPdf: () => void
  onDownloadWorkbookPdf: () => void
  progressValue: number
  status: BuildStatus
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Build Status</CardTitle>
          <CardDescription>{status}</CardDescription>
        </div>
        <CardAction>
          <Badge variant={status === "Error" ? "destructive" : "secondary"}>{status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[180px_1fr]">
        <div>
          <Progress value={progressValue}>
            <ProgressLabel>Pipeline</ProgressLabel>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {progressValue}%
            </span>
          </Progress>
        </div>
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Lesson guide PDF</div>
              <div className="text-xs text-muted-foreground">Print-quality, non-fillable output</div>
            </div>
            <Button disabled={isWorking} onClick={onDownloadPdf}>
              {isWorking ? (
                <LoaderCircleIcon data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              Generate PDF
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Workbook PDF</div>
              <div className="text-xs text-muted-foreground">Workbook pages, not fillable</div>
            </div>
            <Button
              data-testid="download-workbook-pdf"
              disabled={isWorking}
              onClick={onDownloadWorkbookPdf}
              variant="outline"
            >
              {isWorking ? (
                <LoaderCircleIcon data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              Generate Workbook
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Fillable workbook</div>
              <div className="text-xs text-muted-foreground">Fields only on workbook pages</div>
            </div>
            <Button disabled={isWorking} onClick={onDownloadFillable} variant="outline">
              {isWorking ? (
                <LoaderCircleIcon data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              Generate Fillable
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function filenameFromResponse(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition")
  const match = disposition?.match(/filename="([^"]+)"/)

  return match?.[1] ?? fallback
}

function fallbackFilename(kind: "render" | "fillable", target: string) {
  if (kind === "fillable") {
    return target === "complete" ? "kit-fillable.pdf" : "kit-workbook-fillable.pdf"
  }

  return target === "complete" ? "kit-complete.pdf" : "kit-lesson-guide.pdf"
}
