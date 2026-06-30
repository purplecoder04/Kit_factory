"use client"

import { type CSSProperties, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  FolderOpenIcon,
  Layers3Icon,
  LoaderCircleIcon,
  PackageIcon,
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
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { goldenKitMarkdown } from "@/lib/goldenKit"
import { defaultDesignPresetForBranch } from "@/lib/parser/pageTypes"
import { cn } from "@/lib/utils"
import type { ContentBlock, KitPage, OutputMode, ParsedKit, ValidationIssue } from "@/lib/parser/pageTypes"
import {
  branchOptions,
  designPresetOptions,
  getBranchInfo,
  getDesignPreset,
  type DesignPresetTokens,
} from "@/tokens"

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
  | "Mockup Generated"
  | "Package Generated"
  | "Error"

type PackageKey =
  | "lessonBook"
  | "couplesWorkbook"
  | "riseWorkbook"
  | "landWorkbook"

type PackageMarkdowns = Record<PackageKey, string>

const packageDocuments: {
  key: PackageKey
  title: string
  bodyKey: string
}[] = [
  { key: "lessonBook", title: "Lesson Book", bodyKey: "lessonBookMarkdown" },
  { key: "couplesWorkbook", title: "Couples Workbook", bodyKey: "couplesWorkbookMarkdown" },
  { key: "riseWorkbook", title: "Rise Individual", bodyKey: "riseWorkbookMarkdown" },
  { key: "landWorkbook", title: "Land Individual", bodyKey: "landWorkbookMarkdown" },
]

const savedKits = [
  { name: "GYBS Brand Kit", date: "Golden test", status: "Preview Ready" },
  { name: "Offer Clarity Kit", date: "Draft", status: "Draft" },
  { name: "Launch Reset Kit", date: "Archived", status: "PDF Generated" },
]

export function KitFactoryDashboard() {
  const [markdown, setMarkdown] = useState(goldenKitMarkdown)
  const [branch, setBranch] = useState("brand")
  const [designPreset, setDesignPreset] = useState("brand")
  const [outputMode, setOutputMode] = useState<OutputMode>("split")
  const [packageMarkdowns, setPackageMarkdowns] = useState<PackageMarkdowns>(() =>
    createPackageMarkdowns()
  )
  const [result, setResult] = useState<ParseResult | null>(null)
  const [status, setStatus] = useState<BuildStatus>("Draft")
  const [message, setMessage] = useState("Golden kit loaded.")
  const [isWorking, setIsWorking] = useState(false)
  const selectedTokens = useMemo(() => getDesignPreset(designPreset, branch), [branch, designPreset])
  const filteredDesignPresetOptions = useMemo(
    () => designPresetOptions.filter((option) => option.branch === branch),
    [branch]
  )
  const colorwayStyle = useMemo(
    () =>
      ({
        "--brand-plum": selectedTokens.plum,
        "--brand-paper": selectedTokens.paper,
        "--brand-coral": selectedTokens.accent,
        "--brand-sage": selectedTokens.sage,
        "--brand-line": selectedTokens.line,
        "--primary": selectedTokens.accent,
        "--primary-foreground": selectedTokens.paper,
        "--secondary": selectedTokens.lilac,
        "--secondary-foreground": selectedTokens.ink,
        "--brand-soft": selectedTokens.lilac,
      }) as CSSProperties,
    [selectedTokens]
  )

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
    if (status === "Mockup Generated") return 88
    if (status === "Fillable Generated" || status === "Package Generated") return 100
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
        body: JSON.stringify({ markdown, branch, designPreset, outputMode }),
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
        body: JSON.stringify({ markdown, branch, designPreset, outputMode, target }),
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

  async function downloadMockup() {
    setIsWorking(true)
    setMessage("Generating website mockup image.")

    try {
      const response = await fetch("/api/mockup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown, branch, designPreset, outputMode }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { issues?: ValidationIssue[] }
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage("Fix the validation errors before rendering the mockup.")
        return
      }

      const blob = await response.blob()
      const filename = filenameFromResponse(response, "kit-website-mockup.png")
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setStatus("Mockup Generated")
      setMessage(`${filename} downloaded.`)
    } catch {
      setStatus("Error")
      setMessage("The mockup image could not be generated.")
    } finally {
      setIsWorking(false)
    }
  }

  async function downloadMeetPackage() {
    setIsWorking(true)
    setMessage("Generating Meet at the Heal package.")

    try {
      const response = await fetch("/api/package/meetatheal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonBookMarkdown: packageMarkdowns.lessonBook,
          couplesWorkbookMarkdown: packageMarkdowns.couplesWorkbook,
          riseWorkbookMarkdown: packageMarkdowns.riseWorkbook,
          landWorkbookMarkdown: packageMarkdowns.landWorkbook,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { issues?: ValidationIssue[] }
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage("Fix the package markdown before exporting.")
        return
      }

      const blob = await response.blob()
      const filename = filenameFromResponse(response, "meet-at-the-heal-kit-package.zip")
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setStatus("Package Generated")
      setMessage(`${filename} downloaded.`)
    } catch {
      setStatus("Error")
      setMessage("The Meet at the Heal package could not be generated.")
    } finally {
      setIsWorking(false)
    }
  }

  async function downloadBrandPackage() {
    setIsWorking(true)
    setMessage("Generating Brand style package.")

    try {
      const response = await fetch("/api/package/brand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { issues?: ValidationIssue[] }
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage("Fix the Brand markdown before exporting the package.")
        return
      }

      const blob = await response.blob()
      const filename = filenameFromResponse(response, "brand-style-package.zip")
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setStatus("Package Generated")
      setMessage(`${filename} downloaded.`)
    } catch {
      setStatus("Error")
      setMessage("The Brand package could not be generated.")
    } finally {
      setIsWorking(false)
    }
  }

  function updatePackageMarkdown(key: PackageKey, value: string) {
    setPackageMarkdowns((current) => ({
      ...current,
      [key]: value,
    }))
    setStatus("Draft")
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
    <div className="min-h-screen bg-background text-foreground" style={colorwayStyle}>
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
                <Select
                  value={branch}
                  onValueChange={(value) => {
                    const nextBranch = String(value)
                    const nextPreset = defaultDesignPresetForBranch(nextBranch)
                    setBranch(nextBranch)
                    setDesignPreset(nextPreset)
                    setMarkdown((current) =>
                      updateMarkdownFrontmatter(current, {
                        branch: nextBranch,
                        design_preset: nextPreset,
                      })
                    )
                    setStatus("Draft")
                    setMessage("Branch and design preset updated.")
                  }}
                >
                  <SelectTrigger className="w-full md:w-44">
                    <span className="flex flex-1 text-left">{getBranchInfo(branch).shortName}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {branchOptions.map((option) => (
                        <SelectItem key={option.slug} value={option.slug}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Design Preset</FieldLabel>
                <Select
                  value={designPreset}
                  onValueChange={(value) => {
                    const nextPreset = String(value)
                    setDesignPreset(nextPreset)
                    setMarkdown((current) =>
                      updateMarkdownFrontmatter(current, {
                        design_preset: nextPreset,
                      })
                    )
                    setStatus("Draft")
                    setMessage("Design preset updated.")
                  }}
                >
                  <SelectTrigger className="w-full md:w-56">
                    <span className="flex flex-1 text-left">{selectedTokens.name}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {filteredDesignPresetOptions.map((option) => (
                        <SelectItem key={option.slug} value={option.slug}>
                          {option.name}
                        </SelectItem>
                      ))}
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
                      setMarkdown((current) =>
                        updateMarkdownFrontmatter(current, {
                          output_mode: next,
                        })
                      )
                      setStatus("Draft")
                      setMessage("Output mode updated.")
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

              {branch === "brand" && (
                <BrandPackagePanel
                  isWorking={isWorking}
                  onDownloadPackage={downloadBrandPackage}
                />
              )}

              {branch === "meetatheal" && (
                <MeetPackagePanel
                  isWorking={isWorking}
                  markdowns={packageMarkdowns}
                  onDownloadPackage={downloadMeetPackage}
                  onUpdateMarkdown={updatePackageMarkdown}
                />
              )}

              <ValidationPanel
                blockingErrors={blockingErrors}
                isWorking={isWorking}
                issues={result?.issues ?? []}
                onRevalidate={parseMarkdown}
                warnings={warningIssues}
              />
            </section>

            <section className="order-first grid min-w-0 gap-4 xl:order-none xl:grid-rows-[1fr_auto]">
              <PagePreview branch={branch} designPreset={designPreset} kit={result?.kit ?? null} />
              <OutputPanel
                branchLabel={getBranchInfo(branch).shortName}
                designLabel={selectedTokens.name}
                isWorking={isWorking}
                onDownloadFillable={() => downloadOutput("fillable")}
                onDownloadMockup={downloadMockup}
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

function BrandPackagePanel({
  isWorking,
  onDownloadPackage,
}: {
  isWorking: boolean
  onDownloadPackage: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Brand Package</CardTitle>
          <CardDescription>One markdown file, two Brand product styles</CardDescription>
        </div>
        <CardAction>
          <Button disabled={isWorking} onClick={onDownloadPackage} variant="outline">
            {isWorking ? (
              <LoaderCircleIcon data-icon="inline-start" />
            ) : (
              <PackageIcon data-icon="inline-start" />
            )}
            Generate Brand ZIP
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-sm font-medium">Brand Signature</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Plum, orchid, and gold business styling
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-sm font-medium">Brand Land</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Same Brand content with the grounded Land palette
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MeetPackagePanel({
  isWorking,
  markdowns,
  onDownloadPackage,
  onUpdateMarkdown,
}: {
  isWorking: boolean
  markdowns: PackageMarkdowns
  onDownloadPackage: () => void
  onUpdateMarkdown: (key: PackageKey, value: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Meet at the Heal Package</CardTitle>
          <CardDescription>Four documents, four PDFs, one ZIP export</CardDescription>
        </div>
        <CardAction>
          <Button disabled={isWorking} onClick={onDownloadPackage} variant="outline">
            {isWorking ? (
              <LoaderCircleIcon data-icon="inline-start" />
            ) : (
              <PackageIcon data-icon="inline-start" />
            )}
            Generate Package
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="lessonBook">
          <TabsList className="flex w-full flex-wrap justify-start">
            {packageDocuments.map((document) => (
              <TabsTrigger key={document.key} value={document.key}>
                {document.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {packageDocuments.map((document) => (
            <TabsContent className="mt-3" key={document.key} value={document.key}>
              <Textarea
                aria-label={`${document.title} markdown`}
                className="h-[260px] resize-none font-mono text-xs leading-6"
                onChange={(event) => onUpdateMarkdown(document.key, event.target.value)}
                value={markdowns[document.key]}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function PagePreview({
  branch,
  designPreset,
  kit,
}: {
  branch: string
  designPreset: string
  kit: ParsedKit | null
}) {
  const pages = kit?.pages ?? []
  const tokens = getDesignPreset(designPreset, branch)
  const previewStyle = makePreviewStyle(tokens)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeIndex = pages.length > 0 ? Math.min(selectedIndex, pages.length - 1) : 0
  const selectedPage = pages[safeIndex] ?? null

  return (
    <Card className="min-h-[520px]" style={previewStyle}>
      <CardHeader>
        <div>
          <CardTitle>Live Design Preview</CardTitle>
          <CardDescription>
            {pages.length} pages detected - {tokens.name}
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline">US Letter</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[156px_1fr]">
          <div className="order-2 max-h-[240px] overflow-auto rounded-lg border lg:order-1 lg:max-h-[430px]">
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
                style={
                  safeIndex === index
                    ? {
                        background: tokens.accentSoft,
                        color: tokens.ink,
                      }
                    : undefined
                }
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

          <div className="order-1 lg:order-2">
            <MiniPagePreview
              kit={kit}
              page={selectedPage}
              pageNumber={safeIndex + 1}
              selectedBranch={branch}
              tokens={tokens}
              total={pages.length}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function makePreviewStyle(tokens: DesignPresetTokens) {
  return {
    "--preview-paper": tokens.paper,
    "--preview-paper-alt": tokens.paperAlt,
    "--preview-ink": tokens.ink,
    "--preview-muted": tokens.mutedInk,
    "--preview-accent": tokens.accent,
    "--preview-soft": tokens.accentSoft,
    "--preview-plum": tokens.plum,
    "--preview-gold": tokens.gold,
    "--preview-sage": tokens.sage,
    "--preview-rose": tokens.rose,
    "--preview-blue": tokens.blue,
    "--preview-line": tokens.line,
  } as CSSProperties
}

function getPreviewCoverArtPath(tokens: DesignPresetTokens) {
  if (tokens.slug === "brand") {
    return "/kit-assets/brand-cover-bg.png"
  }

  if (tokens.slug === "brand-land") {
    return "/kit-assets/brand-land-cover-bg.png"
  }

  if (tokens.styleFamily === "rise") {
    return "/kit-assets/rise-cover-bg.png"
  }

  if (tokens.styleFamily === "land") {
    return "/kit-assets/land-cover-bg.png"
  }

  if (tokens.styleFamily === "rebuild") {
    return "/kit-assets/rebuild-cover-bg.png"
  }

  if (tokens.styleFamily === "meetatheal") {
    return "/kit-assets/meetatheal-cover-bg.png"
  }

  return ""
}

function MiniPreviewDecorations({
  pageType,
  tokens,
}: {
  pageType?: KitPage["type"] | null
  tokens: DesignPresetTokens
}) {
  const coverArtPath = pageType === "cover" ? getPreviewCoverArtPath(tokens) : ""
  const useCoverArt = Boolean(coverArtPath)

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
      {useCoverArt ? (
        <>
          <span
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${coverArtPath}')` }}
          />
          <span className="absolute inset-0 bg-[var(--preview-paper)] opacity-[0.04]" />
        </>
      ) : (
        <>
          <span
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: `radial-gradient(${tokens.ink} 0.45px, transparent 0.55px), radial-gradient(${tokens.paperAlt} 0.5px, transparent 0.6px)`,
              backgroundPosition: "0 0, 5px 6px",
              backgroundSize: "8px 8px, 10px 10px",
            }}
          />
          <span
            className="absolute -right-12 -top-12 size-32 rounded-full opacity-30"
            style={{ background: tokens.accentSoft }}
          />
          <span
            className="absolute -bottom-20 -left-20 size-44 rounded-full opacity-25"
            style={{ border: `1px solid ${tokens.gold}` }}
          />
          <span
            className="absolute right-7 top-8 h-11 w-11 opacity-40"
            style={{
              backgroundImage: `radial-gradient(${tokens.accent} 1.5px, transparent 1.5px)`,
              backgroundSize: "10px 10px",
            }}
          />
        </>
      )}

      {!useCoverArt && tokens.styleFamily === "brand" && (
        <>
          <span
            className="absolute -left-20 -top-16 size-44 rounded-full opacity-18"
            style={{ background: tokens.plum }}
          />
          <span
            className="absolute left-9 top-5 size-28 rounded-full opacity-16"
            style={{ background: tokens.lilac }}
          />
          <span
            className="absolute -left-12 bottom-5 size-32 rounded-full opacity-45"
            style={{ border: `1px solid ${tokens.gold}` }}
          />
          <span
            className="absolute bottom-8 left-9 size-12 rounded-full shadow-sm"
            style={{
              border: `7px solid ${tokens.ink}`,
              background: `radial-gradient(circle, ${tokens.gold} 0 30%, ${tokens.paper} 31%)`,
            }}
          />
          <span
            className="absolute bottom-10 left-[45%] h-10 w-20 rotate-[-6deg] rounded border shadow-sm"
            style={{ borderColor: tokens.line, background: tokens.paper }}
          >
            <span
              className="absolute left-4 right-4 top-4 h-px"
              style={{ background: tokens.accent }}
            />
            <span
              className="absolute left-4 right-4 top-6 h-px opacity-45"
              style={{ background: tokens.ink }}
            />
          </span>
          <span
            className="absolute bottom-8 right-8 h-16 w-20 rotate-[3deg] rounded-sm shadow-sm"
            style={{ background: tokens.ink }}
          >
            <span
              className="absolute -bottom-2 -left-1 h-2 w-[5.5rem] rounded-sm opacity-80"
              style={{ background: tokens.ink }}
            />
          </span>
          <span className="absolute bottom-24 right-16 h-16 w-8 opacity-70">
            <span className="absolute bottom-0 left-2 size-5 rounded-b-sm" style={{ background: tokens.gold }} />
            <span className="absolute bottom-5 left-5 h-9 w-px" style={{ background: tokens.sage }} />
            <span className="absolute bottom-9 left-2 h-2 w-3 rounded-full" style={{ background: tokens.sage }} />
            <span className="absolute bottom-7 left-6 h-2 w-3 rounded-full" style={{ background: tokens.sage }} />
          </span>
        </>
      )}

      {!useCoverArt && tokens.styleFamily === "rise" && (
        <>
          <span
            className="absolute -right-16 top-12 h-32 w-44 rotate-[-28deg] rounded-[48%] opacity-35"
            style={{
              background: `linear-gradient(105deg, transparent 0 20%, ${tokens.rose} 20% 58%, transparent 59%)`,
            }}
          />
          <span
            className="absolute -left-10 top-8 h-36 w-24 rotate-[15deg] rounded-[48%] opacity-25"
            style={{
              background: `linear-gradient(112deg, transparent 0 28%, ${tokens.rose} 28% 62%, transparent 63%)`,
            }}
          />
          <span
            className="absolute bottom-12 left-4 h-44 w-20 rotate-[18deg] opacity-30"
            style={{
              background: `linear-gradient(125deg, transparent 0 32%, ${tokens.lilac} 32% 68%, transparent 69%)`,
            }}
          />
          <span
            className="absolute bottom-28 left-1/2 h-5 w-8 -translate-x-1/2 opacity-80"
            style={{
              background: tokens.accent,
              clipPath:
                "polygon(0 88%, 13% 34%, 32% 64%, 50% 8%, 68% 64%, 87% 34%, 100% 88%, 100% 100%, 0 100%)",
            }}
          />
          <span
            className="absolute bottom-7 right-14 h-16 w-9 rotate-[-7deg] rounded-b-full rounded-t-md border-2 opacity-75"
            style={{
              borderColor: tokens.rose,
              background: `linear-gradient(to top, ${tokens.accentSoft} 0 45%, transparent 46%)`,
            }}
          />
          <span
            className="absolute bottom-8 right-24 h-10 w-16 rounded-md border opacity-75 shadow-sm"
            style={{
              borderColor: tokens.accent,
              background: `linear-gradient(to bottom, ${tokens.paper} 0 32%, ${tokens.rose} 33% 48%, ${tokens.paper} 49% 68%, ${tokens.rose} 69%)`,
            }}
          />
        </>
      )}

      {!useCoverArt && tokens.styleFamily === "land" && (
        <>
          <span
            className="absolute -left-6 -top-10 h-52 w-96 opacity-30"
            style={{
              background: tokens.sage,
              clipPath: "polygon(0 0, 100% 0, 48% 100%, 0 82%)",
            }}
          />
          <span
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: `repeating-linear-gradient(155deg, transparent 0 17px, ${tokens.gold} 18px 19px, transparent 20px 36px)`,
            }}
          />
          <span
            className="absolute bottom-2 right-0 h-32 w-44 opacity-40"
            style={{
              background: tokens.sage,
              clipPath: "polygon(0 85%, 18% 52%, 32% 72%, 52% 32%, 76% 78%, 90% 54%, 100% 86%, 100% 100%, 0 100%)",
            }}
          />
          <span
            className="absolute bottom-14 right-16 size-16 rounded-full border-2 opacity-75 shadow-sm"
            style={{
              borderColor: tokens.gold,
              background: `radial-gradient(circle, ${tokens.gold} 0 7%, transparent 8%), ${tokens.paper}`,
            }}
          >
            <span
              className="absolute left-7 top-3 h-10 w-2 rotate-[38deg]"
              style={{
                background: tokens.ink,
                clipPath:
                  "polygon(50% 0, 100% 47%, 58% 47%, 58% 100%, 42% 100%, 42% 47%, 0 47%)",
              }}
            />
          </span>
          <span
            className="absolute bottom-8 right-24 h-4 w-24 rotate-[-12deg] rounded-full opacity-75 shadow-sm"
            style={{
              background: `linear-gradient(90deg, ${tokens.rose}, ${tokens.ink})`,
            }}
          />
        </>
      )}

      {!useCoverArt && tokens.styleFamily === "rebuild" && (
        <>
          <span
            className="absolute -right-14 top-10 h-56 w-48 rounded-full opacity-50 blur-sm"
            style={{ background: tokens.blue }}
          />
          <span
            className="absolute bottom-0 left-2 h-36 w-28 rounded-full opacity-35 blur-sm"
            style={{ background: tokens.lilac }}
          />
          <span
            className="absolute right-0 top-12 h-28 w-40 opacity-45"
            style={{
              backgroundImage: `repeating-linear-gradient(145deg, transparent 0 17px, ${tokens.gold} 18px 19px, transparent 20px 34px)`,
            }}
          />
          <span
            className="absolute bottom-7 right-10 h-12 w-16 rounded border opacity-75 shadow-sm"
            style={{ borderColor: tokens.gold, background: tokens.paperAlt }}
          />
          <span
            className="absolute bottom-12 right-20 h-14 w-14 rotate-[-4deg] rounded border-2 bg-white/45 opacity-75 shadow-sm"
            style={{ borderColor: tokens.gold, color: tokens.ink }}
          >
            <span className="absolute inset-x-0 top-5 text-center font-heading text-xs italic">new</span>
          </span>
          <span
            className="absolute bottom-6 right-28 h-14 w-10 rounded-b-xl rounded-t-sm border opacity-75 shadow-sm"
            style={{
              borderColor: tokens.blue,
              background: `linear-gradient(to top, ${tokens.blue}55 0 44%, ${tokens.paper} 45%)`,
            }}
          />
          <span className="absolute bottom-12 left-8 h-24 w-10 opacity-55">
            <span className="absolute bottom-0 left-5 h-20 w-px" style={{ background: tokens.sage }} />
            <span className="absolute bottom-16 left-1 h-3 w-4 rounded-full" style={{ background: tokens.sage }} />
            <span className="absolute bottom-11 left-6 h-3 w-4 rounded-full" style={{ background: tokens.sage }} />
            <span className="absolute bottom-7 left-0 h-3 w-4 rounded-full" style={{ background: tokens.sage }} />
          </span>
        </>
      )}

      {!useCoverArt && tokens.styleFamily === "meetatheal" && (
        <>
          <span
            className="absolute bottom-14 left-1/2 h-28 w-52 -translate-x-1/2 opacity-45"
            style={{
              background: `radial-gradient(ellipse at 42% 100%, transparent 0 43%, ${tokens.gold} 44% 45%, transparent 46%), radial-gradient(ellipse at 58% 100%, transparent 0 43%, ${tokens.rose} 44% 45%, transparent 46%)`,
            }}
          />
          <span
            className="absolute bottom-4 right-5 h-20 w-28 opacity-30"
            style={{
              background: tokens.blue,
              clipPath: "polygon(0 88%, 22% 52%, 36% 70%, 58% 34%, 78% 78%, 90% 56%, 100% 88%, 100% 100%, 0 100%)",
            }}
          />
          <span
            className="absolute left-1/2 top-24 h-9 w-9 -translate-x-1/2 rotate-[-45deg] rounded opacity-65"
            style={{ background: tokens.rose }}
          >
            <span className="absolute -top-[18px] left-0 size-9 rounded-full" style={{ background: tokens.rose }} />
            <span className="absolute left-[18px] top-0 size-9 rounded-full" style={{ background: tokens.rose }} />
          </span>
          <span
            className="absolute bottom-8 right-9 h-9 w-16 rotate-[-4deg] rounded border bg-white/50 opacity-75 shadow-sm"
            style={{ borderColor: tokens.gold }}
          />
        </>
      )}
    </div>
  )
}

function MiniPagePreview({
  kit,
  page,
  pageNumber,
  selectedBranch,
  tokens,
  total,
}: {
  kit: ParsedKit | null
  page: KitPage | null
  pageNumber: number
  selectedBranch: string
  tokens: DesignPresetTokens
  total: number
}) {
  const section = page?.section || page?.rawType || kit?.branch || "brand"
  const footer = getBranchInfo(selectedBranch).footer
  const showRibbon = page?.type !== "cover" && page?.type !== "closing"
  const isCover = page?.type === "cover"

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[8.5/11] w-full max-w-[400px] overflow-hidden rounded-lg border shadow-md",
        "border-[var(--preview-line)] bg-[var(--preview-paper)] text-[var(--preview-ink)]"
      )}
      data-testid="selected-page-preview"
    >
      <MiniPreviewDecorations pageType={page?.type} tokens={tokens} />
      {showRibbon && (
        <div
          className={cn(
            "relative z-10 flex h-9 items-center px-5 text-[8px] font-bold uppercase tracking-[0.28em]",
            tokens.styleFamily === "land"
              ? "bg-[var(--preview-plum)] text-[var(--preview-paper)]"
              : "border-b border-[var(--preview-line)] bg-transparent text-[var(--preview-accent)]"
          )}
        >
          {section}
        </div>
      )}
      <MiniPageBody kit={kit} page={page} tokens={tokens} />
      <div
        className={cn(
          "absolute bottom-5 left-7 right-7 z-20 flex justify-between text-[8px]",
          isCover
            ? "text-[var(--preview-paper)] drop-shadow"
            : "border-t border-[var(--preview-line)] pt-3 text-muted-foreground"
        )}
      >
        <span>{footer}</span>
        <span>
          {total > 0 ? pageNumber : 0} / {total}
        </span>
      </div>
    </div>
  )
}

function MiniPageBody({
  kit,
  page,
  tokens,
}: {
  kit: ParsedKit | null
  page: KitPage | null
  tokens: DesignPresetTokens
}) {
  if (!page) {
    return (
      <div className="relative z-10 p-7">
        <div className="font-heading text-3xl font-semibold text-[var(--preview-ink)]">Kit Preview</div>
      </div>
    )
  }

  if (page.type === "cover") {
    const coverTitle = kit?.title || page.title
    const longCoverTitle = coverTitle.length > 24

    if (tokens.styleFamily === "land") {
      const kitTitle = cleanCoverKitTitle(coverTitle)
      const collectionTitle = tokens.slug === "meetatheal-land" ? "Meet at the Heal" : "Land"
      const collectionLine =
        tokens.slug === "meetatheal-land"
          ? page.subtitle || kit?.subtitle || "Two Worlds. One Choice. A Stronger We."
          : "Build. Grow. Stand Firm."
      const landTagline =
        tokens.slug === "meetatheal-land"
          ? page.tagline || kit?.tagline
          : page.subtitle || kit?.subtitle || page.tagline || kit?.tagline

      return (
        <div className="relative z-10 flex h-[calc(100%-72px)] flex-col items-center px-8 pt-9 text-center">
          <span
            aria-hidden="true"
            className="mb-3 h-4 w-9"
            style={{
              background: tokens.gold,
              clipPath: "polygon(0 85%, 28% 36%, 42% 58%, 58% 18%, 100% 85%, 88% 85%, 58% 42%, 43% 70%, 30% 54%, 12% 85%)",
            }}
          />
          <div
            className="max-w-[285px] break-words font-heading text-[52px] font-semibold uppercase leading-[0.9] tracking-[0.12em]"
            style={{ color: tokens.ink }}
          >
            {collectionTitle}
          </div>
          <div className="mt-3 max-w-[245px] text-[8px] font-bold uppercase tracking-[0.34em] text-[var(--preview-muted)]">
            {collectionLine}
          </div>
          <div className="my-4 h-px w-16 bg-[var(--preview-gold)]" />
          <div className="max-w-[250px] font-heading text-[25px] font-semibold uppercase leading-[1.05] text-[var(--preview-ink)]">
            {kitTitle}
          </div>
          <div className="mt-3 bg-[var(--preview-ink)] px-4 py-1.5 text-[8px] font-bold uppercase tracking-[0.24em] text-[var(--preview-paper)] shadow-sm">
            {previewProductLabel(kit)}
          </div>
          {landTagline && (
            <div className="absolute bottom-3 left-8 right-8 text-[7px] font-bold uppercase tracking-[0.22em] text-[var(--preview-paper)]">
              {landTagline}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        className={cn(
          "relative z-10 flex h-[calc(100%-72px)] flex-col px-8 py-9",
          tokens.styleFamily === "rebuild"
            ? "items-start justify-center text-left"
            : "items-center justify-center text-center"
        )}
      >
        <div
          className="mb-5 text-[9px] font-bold uppercase tracking-[0.34em] text-[var(--preview-accent)]"
        >
          {tokens.shortName}
        </div>
        <div
          className={cn(
            "max-w-[270px] break-words font-heading font-semibold uppercase leading-[0.92]",
            "text-[35px]",
            tokens.styleFamily === "rebuild" && "text-[32px]",
            longCoverTitle && "max-w-[300px] text-[30px] leading-[0.98]",
            longCoverTitle && tokens.styleFamily === "rebuild" && "text-[28px]",
            longCoverTitle && tokens.styleFamily === "meetatheal" && "text-[29px]",
            tokens.styleFamily === "meetatheal" && "normal-case"
          )}
          style={{ color: tokens.ink }}
        >
          {coverTitle}
        </div>
        <div className="mt-5 h-px w-16 bg-[var(--preview-accent)]" />
        {page.subtitle && (
          <div className="mt-5 max-w-[250px] text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--preview-muted)]">
            {page.subtitle}
          </div>
        )}
        {page.tagline && (
          <div className="mt-8 max-w-[230px] text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--preview-muted)]">
            {page.tagline}
          </div>
        )}
      </div>
    )
  }

  if (page.type === "closing") {
    return (
      <div className="relative z-10 p-5">
        <MiniPageHeading page={page} />
        <div className="mt-4 rounded-lg bg-[var(--preview-plum)] p-5 text-center text-[var(--preview-paper)]">
          <div className="mx-auto mb-4 size-3 rotate-45 bg-[var(--preview-paper)]" />
          <MiniContent blocks={page.content} compact />
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 p-5">
      <MiniPageHeading page={page} />
      <MiniContent blocks={page.content} />
      <MiniFillablePreview page={page} />
    </div>
  )
}

function cleanCoverKitTitle(title: string) {
  return title.replace(/\s+kit$/i, "").trim()
}

function previewProductLabel(kit: ParsedKit | null) {
  if (kit?.outputMode === "split") {
    return "Lesson Guide + Workbook"
  }

  return (kit?.productType || "workbook")
    .replace(/-/g, " + ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function MiniPageHeading({ page }: { page: KitPage }) {
  return (
    <>
      <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-primary">
        {page.section || page.rawType}
      </div>
      <div className="mt-2 font-heading text-lg font-semibold leading-tight text-[var(--preview-ink)]">
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

        if (block.type === "check-list") {
          return (
            <ul className="grid gap-1.5 text-[10px] leading-5 text-muted-foreground" key={`${block.type}-${index}`}>
              {block.items.slice(0, 4).map((item) => (
                <li className="grid grid-cols-[12px_1fr] gap-2" key={item}>
                  <span className="mt-1 size-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === "quote") {
          return (
            <div
              className="rounded-lg border-l-4 border-l-[var(--preview-plum)] bg-[var(--preview-soft)] p-4"
              key={`${block.type}-${index}`}
            >
              <div className="font-heading text-lg italic leading-tight text-[var(--preview-ink)]">{block.text}</div>
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
            <div
              className="rounded-lg border-l-4 border-l-[var(--preview-plum)] bg-[var(--preview-soft)] p-4"
              key={`${block.type}-${index}`}
            >
              <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[var(--preview-ink)]">Key Term</div>
              <div className="mt-2 font-heading text-xl font-semibold text-[var(--preview-ink)]">{block.term}</div>
              <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-muted-foreground">{block.text}</p>
            </div>
          )
        }

        if (block.type === "alert") {
          return (
            <div
              className="rounded-lg border-l-4 border-l-primary bg-white/55 p-3 text-[10px] leading-5 text-[var(--preview-ink)]"
              key={`${block.type}-${index}`}
            >
              {block.text}
            </div>
          )
        }

        return (
          <div
            className="rounded-lg border border-[var(--preview-line)] border-l-4 border-l-primary bg-white/45 p-3"
            key={`${block.type}-${index}`}
          >
            <div className="font-heading text-xs italic leading-tight text-[var(--preview-ink)]">{block.text}</div>
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
            className="rounded-lg border border-[var(--preview-line)] border-l-4 border-l-primary bg-white/50 p-2 shadow-sm"
            key={`${prompt}-${index}`}
          >
            <div className="font-heading text-xs italic leading-tight text-[var(--preview-ink)]">{prompt}</div>
            <div className="mt-2 grid gap-1.5">
              <span className="h-px bg-[var(--preview-line)]" />
              <span className="h-px bg-[var(--preview-line)]" />
              <span className="h-px bg-[var(--preview-line)]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "checklist") {
    const checks = page.checks.length > 0 ? page.checks : page.prompts

    return (
      <div className="mt-3 grid gap-2">
        {checks.slice(0, 5).map((prompt, index) => (
          <div
            className="grid grid-cols-[14px_1fr] gap-2 border-b border-[var(--preview-line)] pb-2 text-[10px]"
            key={`${prompt}-${index}`}
          >
            <span className="mt-0.5 size-3 rounded-sm border border-[var(--preview-accent)]" />
            <span className="line-clamp-1">{prompt}</span>
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "tracker") {
    const headers = page.tableHeaders.length > 0 ? page.tableHeaders.slice(0, 4) : ["Category", "Goal", "Actual", "Notes"]
    const rows = page.tableRows.length > 0 ? page.tableRows.slice(0, 3) : ["", "", ""]

    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-[var(--preview-line)] text-[8px]">
        <div className="grid grid-cols-4 bg-[var(--preview-soft)] font-semibold uppercase tracking-[0.16em] text-[var(--preview-ink)]">
          {headers.map((header) => (
            <span className="p-2" key={header}>{header}</span>
          ))}
        </div>
        {rows.map((row, index) => (
          <div className="grid grid-cols-4 border-t border-[var(--preview-line)]" key={index}>
            <span className="h-8 border-r border-[var(--preview-line)] p-2">{row}</span>
            <span className="h-8 border-r border-[var(--preview-line)]" />
            <span className="h-8 border-r border-[var(--preview-line)]" />
            <span className="h-8" />
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "action-plan") {
    return (
      <div className="mt-3 grid gap-2">
        {page.actions.slice(0, 3).map((action, index) => (
          <div className="grid grid-cols-[18px_1fr] gap-2 text-[10px]" key={`${action}-${index}`}>
            <span className="flex size-5 items-center justify-center rounded-full bg-[var(--preview-plum)] text-[9px] text-[var(--preview-paper)]">
              {index + 1}
            </span>
            <span className="line-clamp-1 border-b border-[var(--preview-line)] pb-2">{action}</span>
          </div>
        ))}
      </div>
    )
  }

  if (page.type === "notes") {
    return (
      <div className="mt-3 grid gap-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <span className="h-px bg-[var(--preview-line)]" key={index} />
        ))}
      </div>
    )
  }

  if (page.type === "reflection" || page.type === "lesson-continue") {
    const reflects = page.reflects.length > 0 ? page.reflects : page.prompts

    return (
      <div className="mt-3 grid gap-2">
        {reflects.slice(0, 2).map((prompt, index) => (
          <div className="rounded-lg border border-[var(--preview-line)] border-l-4 border-l-primary bg-white/45 p-3" key={`${prompt}-${index}`}>
            <div className="font-heading text-xs italic leading-tight text-[var(--preview-ink)]">{prompt}</div>
          </div>
        ))}
      </div>
    )
  }

  return null
}

function OutputPanel({
  branchLabel,
  designLabel,
  isWorking,
  onDownloadFillable,
  onDownloadMockup,
  onDownloadPdf,
  onDownloadWorkbookPdf,
  progressValue,
  status,
}: {
  branchLabel: string
  designLabel: string
  isWorking: boolean
  onDownloadFillable: () => void
  onDownloadMockup: () => void
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
          <CardDescription>
            {status} - {branchLabel} / {designLabel}
          </CardDescription>
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

          <Separator />

          <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Website mockup PNG</div>
              <div className="text-xs text-muted-foreground">Listing-ready product image</div>
            </div>
            <Button disabled={isWorking} onClick={onDownloadMockup} variant="outline">
              {isWorking ? (
                <LoaderCircleIcon data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              Generate Mockup
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

function updateMarkdownFrontmatter(source: string, fields: Record<string, string>) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n"
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const fieldEntries = Object.entries(fields)

  if (!frontmatterMatch) {
    const frontmatter = fieldEntries.map(([key, value]) => `${key}: ${value}`).join(newline)

    return `---${newline}${frontmatter}${newline}---${newline}${newline}${source}`
  }

  const seen = new Set<string>()
  const block = frontmatterMatch[1].split(/\r?\n/)
  const nextBlock = block.map((line) => {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):/)
    const key = keyMatch?.[1]

    if (key && Object.hasOwn(fields, key)) {
      seen.add(key)
      return `${key}: ${fields[key]}`
    }

    return line
  })

  for (const [key, value] of fieldEntries) {
    if (!seen.has(key)) {
      nextBlock.push(`${key}: ${value}`)
    }
  }

  return `${source.slice(0, frontmatterMatch.index ?? 0)}---${newline}${nextBlock.join(
    newline
  )}${newline}---${source.slice(frontmatterMatch[0].length)}`
}

function fallbackFilename(kind: "render" | "fillable", target: string) {
  if (kind === "fillable") {
    return target === "complete" ? "kit-fillable.pdf" : "kit-workbook-fillable.pdf"
  }

  return target === "complete" ? "kit-complete.pdf" : "kit-lesson-guide.pdf"
}

function createPackageMarkdowns(): PackageMarkdowns {
  return {
    lessonBook: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Lesson Book",
      subtitle: "Two Worlds. One Choice. A Stronger We.",
      designPreset: "meetatheal",
      pageType: "lesson",
    }),
    couplesWorkbook: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Couples Workbook",
      subtitle: "Let's heal together.",
      designPreset: "meetatheal",
      pageType: "workbook",
    }),
    riseWorkbook: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Rise Individual Workbook",
      subtitle: "Come back to yourself.",
      designPreset: "meetatheal-rise",
      pageType: "workbook",
    }),
    landWorkbook: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Land Individual Workbook",
      subtitle: "Build. Grow. Stand Firm.",
      designPreset: "meetatheal-land",
      pageType: "workbook",
    }),
  }
}

function createMeetAtTheHealMarkdown({
  title,
  subtitle,
  designPreset,
  pageType,
}: {
  title: string
  subtitle: string
  designPreset: string
  pageType: "lesson" | "workbook"
}) {
  const innerPage =
    pageType === "lesson"
      ? `<!-- PAGE: lesson -->

SECTION: Lesson 01
TITLE: Healing Together

This is the shared lesson space for the couple. Replace this starter text with the final lesson copy.

CHECK: Come back to us.
CHECK: Recognize the patterns.
CHECK: Communicate with care.

REFLECT: What would feel different if we chose repair instead of defense?

BOTTOM_NOTE: We choose us, every day.`
      : `<!-- PAGE: workbook -->

SECTION: Workbook
TITLE: Get Honest With You

PROMPT: What do I keep ignoring about myself?
PROMPT: What do I know deep down I deserve?
PROMPT: What support would help me show up with more honesty?

BOTTOM_NOTE: Healing starts with the truth we are brave enough to name.`

  return `---
title: ${title}
subtitle: ${subtitle}
branch: meetatheal
design_preset: ${designPreset}
product_type: workbook
output_mode: all-in-one
author: Best Collective
tagline: Two worlds. One choice. A stronger we.
---

<!-- PAGE: cover -->

TITLE: ${title}
SUBTITLE: ${subtitle}
TAGLINE: Two worlds. One choice. A stronger we.
ICON: branch-default
IMAGE_SLOT: cover-lifestyle

${innerPage}

<!-- PAGE: closing -->

TITLE: Meet at the Heal
SUBTITLE: Two Worlds. One Choice. A Stronger We.
TAGLINE: We choose us, every day.
ICON: branch-default
IMAGE_SLOT: closing-lifestyle
`
}
