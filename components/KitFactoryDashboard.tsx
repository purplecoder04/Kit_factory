"use client"

import { type CSSProperties, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  FolderOpenIcon,
  HistoryIcon,
  Layers3Icon,
  LoaderCircleIcon,
  PackageIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
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
  kitId?: string | null
}

type ApiErrorPayload = {
  detail?: string
  error?: string
  issues?: ValidationIssue[]
}

type SavedKitLoadResult = ParseResult & {
  branch: string
  designPreset: string
  markdown: string
  outputMode: OutputMode
  productExportUrl: string
  productId: string
  productStatus: string
  status: string
}

type ReadyProductSummary = {
  exportUrl: string
  productId: string
  productStatus: string
  reusedProduct?: boolean
}

type BuildStatus =
  | "Draft"
  | "Parsed"
  | "Preview Ready"
  | "PDF Generated"
  | "Fillable Generated"
  | "Mockup Generated"
  | "Package Generated"
  | "Ready to Sell"
  | "Error"

type PackageKey =
  | "lessonBook"
  | "couplesWorkbook"
  | "riseWorkbook"
  | "landWorkbook"

type PackageMarkdowns = Record<PackageKey, string>

type SavedKitSummary = {
  id: string
  name: string
  status: string
}

type ExportFileSummary = {
  id: string
  exportJobId: string
  fileUrl: string
  fileType: string
  filename: string
  status: string
  createdAt: string
}

type StorageHealthSummary = {
  bucket: string
  cleanupIssue?: string | null
  cleanupOk?: boolean
  issue?: string
  ok: boolean
  publicFetchStatus?: number | string
  publicUrlWorks?: boolean
  serviceRoleConfigured?: boolean
  step: string
}

type DashboardView = "dashboard" | "all-kits"

const packageDocuments: {
  key: PackageKey
  title: string
  bodyKey: string
  description: string
  filenameHint: string
}[] = [
  {
    key: "lessonBook",
    title: "Lesson Book",
    bodyKey: "lessonBookMarkdown",
    description: "Teaches the relationship concepts, examples, stories, and principles.",
    filenameHint: "Use a filename with lesson or guide.",
  },
  {
    key: "couplesWorkbook",
    title: "Couples Workbook",
    bodyKey: "couplesWorkbookMarkdown",
    description: "Holds the shared exercises, discussions, agreements, and action plans.",
    filenameHint: "Use a filename with couples, shared, together, or partner.",
  },
  {
    key: "riseWorkbook",
    title: "Rise Individual Workbook",
    bodyKey: "riseWorkbookMarkdown",
    description: "Holds her private reflection work, emotions, boundaries, and accountability.",
    filenameHint: "Use a filename with rise, her, woman, or women.",
  },
  {
    key: "landWorkbook",
    title: "Land Individual Workbook",
    bodyKey: "landWorkbookMarkdown",
    description: "Holds his private reflection work, leadership, healing, and accountability.",
    filenameHint: "Use a filename with land, his, man, or men.",
  },
]

export function KitFactoryDashboard() {
  const [markdown, setMarkdown] = useState(goldenKitMarkdown)
  const [branch, setBranch] = useState("brand")
  const [designPreset, setDesignPreset] = useState("brand")
  const [outputMode, setOutputMode] = useState<OutputMode>("split")
  const [activeView, setActiveView] = useState<DashboardView>("dashboard")
  const [packageMarkdowns, setPackageMarkdowns] = useState<PackageMarkdowns>(() =>
    createPackageMarkdowns()
  )
  const [result, setResult] = useState<ParseResult | null>(null)
  const [kitId, setKitId] = useState<string | null>(null)
  const [savedKits, setSavedKits] = useState<SavedKitSummary[]>([])
  const [savedKitSearch, setSavedKitSearch] = useState("")
  const [exportFiles, setExportFiles] = useState<ExportFileSummary[]>([])
  const [copyFallbackText, setCopyFallbackText] = useState("")
  const [isLoadingExports, setIsLoadingExports] = useState(false)
  const [isCheckingStorage, setIsCheckingStorage] = useState(false)
  const [readyProduct, setReadyProduct] = useState<ReadyProductSummary | null>(null)
  const [storageHealth, setStorageHealth] = useState<StorageHealthSummary | null>(null)
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
  const filteredSavedKits = useMemo(() => {
    const query = savedKitSearch.trim().toLowerCase()

    if (!query) {
      return savedKits
    }

    return savedKits.filter((kit) =>
      [kit.name, kit.status].some((value) => value.toLowerCase().includes(query))
    )
  }, [savedKitSearch, savedKits])
  const hasPublicExportLink = useMemo(
    () => exportFiles.some((file) => isPublicExportUrl(file.fileUrl)),
    [exportFiles]
  )
  const productHasPublicExportLink = isPublicExportUrl(readyProduct?.exportUrl ?? "")
  const canMarkReady = Boolean(kitId && (hasPublicExportLink || productHasPublicExportLink))
  const progressValue = useMemo(() => {
    if (status === "Draft") return 12
    if (status === "Parsed") return 34
    if (status === "Preview Ready") return 54
    if (status === "PDF Generated") return 76
    if (status === "Mockup Generated") return 88
    if (status === "Fillable Generated" || status === "Package Generated" || status === "Ready to Sell") return 100
    return 18
  }, [status])

  useEffect(() => {
    void parseMarkdown({ persist: false })
    void loadSavedKits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSavedKits() {
    try {
      const response = await fetch("/api/kits")

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as { kits?: SavedKitSummary[] }
      setSavedKits(payload.kits ?? [])
    } catch {
      setSavedKits([])
    }
  }

  async function loadExportFiles(nextKitId = kitId) {
    if (!nextKitId) {
      setExportFiles([])
      setCopyFallbackText("")
      return
    }

    setIsLoadingExports(true)

    try {
      const response = await fetch(`/api/kits/${nextKitId}/exports`)

      if (!response.ok) {
        setExportFiles([])
        setCopyFallbackText("")
        return
      }

      const payload = (await response.json()) as { exports?: ExportFileSummary[] }
      setExportFiles(payload.exports ?? [])
      setCopyFallbackText("")
    } catch {
      setExportFiles([])
      setCopyFallbackText("")
    } finally {
      setIsLoadingExports(false)
    }
  }

  async function checkStorageReadiness() {
    setIsCheckingStorage(true)
    setMessage("Checking export storage.")

    try {
      const response = await fetch("/api/storage/check", {
        method: "POST",
      })
      const payload = (await response.json()) as StorageHealthSummary

      setStorageHealth(payload)
      setMessage(
        payload.ok
          ? "Supabase Storage is ready for public export links."
          : payload.issue || "Supabase Storage is not ready yet."
      )
    } catch {
      setStorageHealth({
        bucket: "kit-exports",
        issue: "The storage check could not run.",
        ok: false,
        step: "unexpected",
      })
      setMessage("The storage check could not run.")
    } finally {
      setIsCheckingStorage(false)
    }
  }

  async function copyStorageSetupSql() {
    try {
      const response = await fetch("/api/storage/setup-sql")

      if (!response.ok) {
        const payload = await readApiErrorPayload(response)
        setMessage(errorMessageFromPayload(payload, "The Supabase setup SQL could not be loaded."))
        return
      }

      const payload = (await response.json()) as { sql?: string }

      await copyExportText(payload.sql ?? "", "Supabase setup SQL copied.")
    } catch {
      setMessage("The Supabase setup SQL could not be copied.")
    }
  }

  async function copyExportText(value: string, successMessage: string) {
    if (!value) {
      setMessage("No export link is available yet.")
      return
    }

    try {
      await writeClipboardText(value)
      setCopyFallbackText("")
      setMessage(successMessage)
    } catch {
      setCopyFallbackText(value)
      setMessage("Links are ready below.")
    }
  }

  function copyLatestExportLink() {
    const latestExport = exportFiles[0]

    void copyExportText(
      latestExport?.fileUrl ?? "",
      copyExportSuccessMessage(latestExport, "Latest export link copied.")
    )
  }

  function copyAllExportLinks() {
    const hasLocalFallbackLinks = exportFiles.some((file) => isLocalFallbackExportUrl(file.fileUrl))
    const exportList = exportFiles
      .map(
        (file) =>
          `${file.fileType}\t${file.filename}\t${exportLinkKindLabel(file.fileUrl)}\t${file.fileUrl}`
      )
      .join("\n")

    void copyExportText(
      exportList,
      hasLocalFallbackLinks
        ? "Export list copied. Local fallbacks still need Supabase Storage for public links."
        : "All export links copied."
    )
  }

  function copySingleExportLink(file: ExportFileSummary) {
    void copyExportText(file.fileUrl, copyExportSuccessMessage(file, `${file.filename} link copied.`))
  }

  async function openSavedKit(savedKitId: string) {
    setIsWorking(true)
    setMessage("Opening saved kit.")

    try {
      const response = await fetch(`/api/kits/${savedKitId}`)

      if (!response.ok) {
        setStatus("Error")
        setMessage("The saved kit could not be opened.")
        return
      }

      const payload = (await response.json()) as SavedKitLoadResult
      const hasErrors = payload.issues.some((issue) => issue.level === "error")

      setMarkdown(payload.markdown)
      setBranch(payload.branch)
      setDesignPreset(payload.designPreset)
      setOutputMode(payload.outputMode)
      setActiveView("dashboard")
      setKitId(payload.kitId ?? savedKitId)
      setResult({
        kit: payload.kit,
        issues: payload.issues,
        kitId: payload.kitId ?? savedKitId,
      })
      setReadyProduct(productSummaryFromPayload(payload))
      void loadExportFiles(payload.kitId ?? savedKitId)
      setStatus(hasErrors ? "Error" : buildStatusFromSavedKit(payload))
      setMessage(hasErrors ? "Saved kit opened with validation errors." : "Saved kit opened.")
    } catch {
      setStatus("Error")
      setMessage("The saved kit could not be opened.")
    } finally {
      setIsWorking(false)
    }
  }

  function startNewKit() {
    const nextBranch = "brand"
    const nextPreset = defaultDesignPresetForBranch(nextBranch)

    setMarkdown(createNewKitMarkdown({
      branch: nextBranch,
      designPreset: nextPreset,
      outputMode: "split",
    }))
    setBranch(nextBranch)
    setDesignPreset(nextPreset)
    setOutputMode("split")
    setPackageMarkdowns(createPackageMarkdowns())
    setResult(null)
    setKitId(null)
    setExportFiles([])
    setCopyFallbackText("")
    setReadyProduct(null)
    setActiveView("dashboard")
    setStatus("Draft")
    setMessage("New kit started.")
  }

  async function parseMarkdown({ persist = true }: { persist?: boolean } = {}) {
    setIsWorking(true)
    setMessage("Checking markdown.")

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown, branch, designPreset, outputMode, kitId, persist }),
      })
      const payload = (await response.json()) as ParseResult
      const hasErrors = payload.issues.some((issue) => issue.level === "error")

      setResult(payload)
      if (payload.kitId) {
        setKitId(payload.kitId)
        void loadExportFiles(payload.kitId)
      } else {
        setExportFiles([])
        setReadyProduct(null)
      }
      void loadSavedKits()
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
        body: JSON.stringify({ markdown, branch, designPreset, outputMode, target, kitId }),
      })

      if (!response.ok) {
        const payload = await readApiErrorPayload(response)
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage(errorMessageFromPayload(payload, "Fix the validation errors before rendering."))
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
      if (kitId) {
        void loadExportFiles(kitId)
      }
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
        body: JSON.stringify({ markdown, branch, designPreset, outputMode, kitId }),
      })

      if (!response.ok) {
        const payload = await readApiErrorPayload(response)
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage(errorMessageFromPayload(payload, "Fix the validation errors before rendering the mockup."))
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
      if (kitId) {
        void loadExportFiles(kitId)
      }
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
          kitId,
          lessonBookMarkdown: packageMarkdowns.lessonBook,
          couplesWorkbookMarkdown: packageMarkdowns.couplesWorkbook,
          riseWorkbookMarkdown: packageMarkdowns.riseWorkbook,
          landWorkbookMarkdown: packageMarkdowns.landWorkbook,
        }),
      })

      if (!response.ok) {
        const payload = await readApiErrorPayload(response)
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage(errorMessageFromPayload(payload, "Fix the package markdown before exporting."))
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
      if (kitId) {
        void loadExportFiles(kitId)
      }
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
        body: JSON.stringify({ markdown, kitId }),
      })

      if (!response.ok) {
        const payload = await readApiErrorPayload(response)
        setResult((current) =>
          current && payload.issues ? { ...current, issues: payload.issues } : current
        )
        setStatus("Error")
        setMessage(errorMessageFromPayload(payload, "Fix the Brand markdown before exporting the package."))
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
      if (kitId) {
        void loadExportFiles(kitId)
      }
      setStatus("Package Generated")
      setMessage(`${filename} downloaded.`)
    } catch {
      setStatus("Error")
      setMessage("The Brand package could not be generated.")
    } finally {
      setIsWorking(false)
    }
  }

  async function markReadyToSell() {
    if (!kitId) {
      setStatus("Error")
      setMessage("Parse the kit before marking it ready to sell.")
      return
    }

    setIsWorking(true)
    setMessage("Marking kit ready to sell.")

    try {
      const response = await fetch(`/api/kits/${kitId}/ready`, {
        method: "POST",
      })

      if (!response.ok) {
        const payload = await readApiErrorPayload(response)
        setStatus("Error")
        setMessage(
          errorMessageFromPayload(
            payload,
            "Generate a public export before marking this kit ready to sell."
          )
        )
        return
      }

      const payload = (await response.json()) as ReadyProductSummary
      await loadSavedKits()
      setReadyProduct(productSummaryFromPayload(payload))
      setStatus("Ready to Sell")
      setMessage(
        payload.reusedProduct
          ? "Existing Product updated and linked to this kit."
          : "Kit marked ready to sell and linked to Products."
      )
    } catch {
      setStatus("Error")
      setMessage("The kit could not be marked ready to sell.")
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

  async function handlePackageFileUpload(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])

    if (files.length === 0) {
      return
    }

    const updates: Partial<PackageMarkdowns> = {}

    await Promise.all(
      files.map(async (file) => {
        const key = packageKeyFromFilename(file.name)

        if (!key) {
          return
        }

        updates[key] = await file.text()
      })
    )

    const loadedCount = Object.keys(updates).length

    if (loadedCount === 0) {
      setStatus("Error")
      setMessage("No Meet at the Heal files were recognized. Name the files with lesson, couples, rise, or land.")
      return
    }

    setPackageMarkdowns((current) => ({
      ...current,
      ...updates,
    }))
    setStatus("Draft")
    setMessage(`${loadedCount} Meet at the Heal package file${loadedCount === 1 ? "" : "s"} loaded. Each tab controls one PDF in the ZIP.`)
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) {
      return
    }

    setMarkdown(await file.text())
    setKitId(null)
    setExportFiles([])
    setCopyFallbackText("")
    setReadyProduct(null)
    setActiveView("dashboard")
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
              {
                label: "Dashboard",
                icon: Layers3Icon,
                active: activeView === "dashboard",
                onClick: () => setActiveView("dashboard"),
              },
              {
                label: "New Kit",
                icon: FileTextIcon,
                active: false,
                onClick: startNewKit,
              },
              {
                label: "All Kits",
                icon: FolderOpenIcon,
                active: activeView === "all-kits",
                onClick: () => {
                  setActiveView("all-kits")
                  void loadSavedKits()
                  setMessage("Saved kit library opened.")
                },
              },
            ].map(({ active, icon: Icon, label, onClick }) => (
              <button
                key={label}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-left transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                )}
                data-testid={`sidebar-${label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={onClick}
                type="button"
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-8 hidden flex-1 flex-col gap-3 lg:flex">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60">
              Saved Kits
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
              <Input
                aria-label="Search saved kits"
                className="h-8 border-sidebar-border bg-sidebar-accent/30 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/45"
                onChange={(event) => setSavedKitSearch(event.target.value)}
                placeholder="Search kits"
                value={savedKitSearch}
              />
            </div>
            {savedKits.length === 0 ? (
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-sm text-sidebar-foreground/65">
                No saved kits yet.
              </div>
            ) : filteredSavedKits.length === 0 ? (
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-sm text-sidebar-foreground/65">
                No kits match that search.
              </div>
            ) : filteredSavedKits.slice(0, 6).map((kit) => (
              <button
                className={cn(
                  "rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-left text-sm transition-colors hover:bg-sidebar-accent/70 disabled:cursor-wait disabled:opacity-70",
                  kit.id === kitId && "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                )}
                data-testid={`saved-kit-${kit.id}`}
                disabled={isWorking}
                key={kit.id}
                onClick={() => void openSavedKit(kit.id)}
                type="button"
              >
                <div className="font-medium">{kit.name}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-sidebar-foreground/65">
                  <span>Supabase</span>
                  <span>{kit.status}</span>
                </div>
              </button>
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
                {result?.kit.title || "Untitled Kit"}
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

              <Button disabled={isWorking} onClick={() => void parseMarkdown()}>
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
              {activeView === "all-kits" ? (
                <SavedKitLibraryPanel
                  activeKitId={kitId}
                  isWorking={isWorking}
                  kits={filteredSavedKits}
                  onNewKit={startNewKit}
                  onOpenKit={openSavedKit}
                  onRefresh={() => void loadSavedKits()}
                  onSearchChange={setSavedKitSearch}
                  search={savedKitSearch}
                  totalCount={savedKits.length}
                />
              ) : (
                <>
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
                      onUploadFiles={handlePackageFileUpload}
                      onUpdateMarkdown={updatePackageMarkdown}
                    />
                  )}
                </>
              )}

              <ValidationPanel
                blockingErrors={blockingErrors}
                isWorking={isWorking}
                issues={result?.issues ?? []}
                onRevalidate={() => void parseMarkdown()}
                warnings={warningIssues}
              />
            </section>

            <section className="order-first grid min-w-0 gap-4 xl:order-none xl:grid-rows-[1fr_auto]">
              <PagePreview branch={branch} designPreset={designPreset} kit={result?.kit ?? null} />
              <OutputPanel
                branchLabel={getBranchInfo(branch).shortName}
                copyFallbackText={copyFallbackText}
                designLabel={selectedTokens.name}
                exportFiles={exportFiles}
                isCheckingStorage={isCheckingStorage}
                isLoadingExports={isLoadingExports}
                isWorking={isWorking}
                onCheckStorage={checkStorageReadiness}
                onCopyAllExports={copyAllExportLinks}
                onCopyExport={copySingleExportLink}
                onCopyLatestExport={copyLatestExportLink}
                onCopyStorageSetupSql={copyStorageSetupSql}
                onDownloadFillable={() => downloadOutput("fillable")}
                onDownloadMockup={downloadMockup}
                onDownloadPdf={() => downloadOutput("render")}
                onDownloadWorkbookPdf={() => downloadOutput("render", "workbook")}
                onMarkReadyToSell={markReadyToSell}
                onRefreshExports={() => void loadExportFiles()}
                product={readyProduct}
                progressValue={progressValue}
                status={status}
                storageHealth={storageHealth}
                canMarkReady={canMarkReady}
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

function SavedKitLibraryPanel({
  activeKitId,
  isWorking,
  kits,
  onNewKit,
  onOpenKit,
  onRefresh,
  onSearchChange,
  search,
  totalCount,
}: {
  activeKitId: string | null
  isWorking: boolean
  kits: SavedKitSummary[]
  onNewKit: () => void
  onOpenKit: (kitId: string) => void
  onRefresh: () => void
  onSearchChange: (value: string) => void
  search: string
  totalCount: number
}) {
  const trimmedSearch = search.trim()
  const visibleCount = kits.length

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>All Kits</CardTitle>
          <CardDescription>
            {trimmedSearch
              ? `Showing ${visibleCount} of ${totalCount} saved kit${totalCount === 1 ? "" : "s"}`
              : `${totalCount} saved kit${totalCount === 1 ? "" : "s"} in Supabase`}
          </CardDescription>
        </div>
        <CardAction className="flex gap-2">
          <Button disabled={isWorking} onClick={onRefresh} type="button" variant="outline">
            Refresh
          </Button>
          <Button disabled={isWorking} onClick={onNewKit} type="button">
            <FileTextIcon data-icon="inline-start" />
            New Kit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="all-kits-search">Search saved kits</FieldLabel>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="all-kits-search"
              id="all-kits-search"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by kit name or status"
              value={search}
              className="pl-8"
            />
          </div>
        </Field>

        {kits.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {search.trim() ? "No saved kits match that search." : "No saved kits yet."}
          </div>
        ) : (
          <div className="grid gap-2">
            {kits.map((kit) => (
              <button
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:opacity-70 md:flex-row md:items-center md:justify-between",
                  kit.id === activeKitId && "border-primary bg-primary/5"
                )}
                data-testid={`all-kits-open-${kit.id}`}
                disabled={isWorking}
                key={kit.id}
                onClick={() => onOpenKit(kit.id)}
                type="button"
              >
                <span>
                  <span className="block font-medium">{kit.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{kit.id}</span>
                </span>
                <Badge variant={kit.status === "ready_to_sell" ? "default" : "secondary"}>
                  {kit.status}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MeetPackagePanel({
  isWorking,
  markdowns,
  onDownloadPackage,
  onUploadFiles,
  onUpdateMarkdown,
}: {
  isWorking: boolean
  markdowns: PackageMarkdowns
  onDownloadPackage: () => void
  onUploadFiles: (fileList: FileList | null) => void
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
      <CardContent className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="meet-package-upload">Upload package markdown files</FieldLabel>
          <p className="text-muted-foreground text-sm">
            Upload the four official markdown files at once. The app matches them by filename and exports one PDF per tab.
          </p>
          <Input
            accept=".md,.markdown,.txt"
            disabled={isWorking}
            id="meet-package-upload"
            multiple
            onChange={(event) => {
              onUploadFiles(event.target.files)
              event.target.value = ""
            }}
            type="file"
          />
        </Field>
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
              <div className="mb-2 space-y-1">
                <FieldTitle>{document.title}</FieldTitle>
                <p className="text-muted-foreground text-sm">{document.description}</p>
                <p className="text-muted-foreground text-xs">{document.filenameHint}</p>
              </div>
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
        <div className="grid gap-4 2xl:grid-cols-[156px_1fr]">
          <div className="order-2 max-h-[240px] overflow-auto rounded-lg border 2xl:order-1 2xl:max-h-[430px]">
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

          <div className="order-1 2xl:order-2">
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
    "--preview-background": tokens.background,
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
    return "/kit-assets/meetatheal-cover-bg-v2.png"
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
  const brandTemplateArtPath = getPreviewBrandTemplateArtPath(pageType, tokens)
  const pageArtPath = coverArtPath || brandTemplateArtPath
  const usePageArt = Boolean(pageArtPath)
  const isWelcome = pageType === "welcome"
  const isToc = pageType === "toc"
  const isSectionDivider = pageType === "section-divider"
  const isBrandLesson = pageType === "lesson" && tokens.styleFamily === "brand"
  const coverArtStyle = {
    backgroundImage: `url('${pageArtPath}')`,
    backgroundPosition:
      brandTemplateArtPath
        ? "center"
        : tokens.styleFamily === "brand" || tokens.styleFamily === "rebuild"
        ? "center bottom"
        : "center",
    backgroundRepeat: "no-repeat",
    backgroundSize:
      brandTemplateArtPath
        ? "cover"
        : tokens.styleFamily === "brand"
        ? "112% auto"
        : tokens.styleFamily === "rebuild"
          ? "116% auto"
          : "cover",
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
      {usePageArt ? (
        <>
          <span className="absolute inset-0 bg-cover bg-center" style={coverArtStyle} />
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

      {!usePageArt && !isWelcome && !isToc && !isSectionDivider && !isBrandLesson && tokens.styleFamily === "brand" && (
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

      {!usePageArt && !isWelcome && !isToc && tokens.styleFamily === "rise" && (
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

      {!usePageArt && !isWelcome && !isToc && tokens.styleFamily === "land" && (
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

      {!usePageArt && !isWelcome && !isToc && tokens.styleFamily === "rebuild" && (
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

      {!usePageArt && !isWelcome && !isToc && tokens.styleFamily === "meetatheal" && (
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

function getPreviewBrandTemplateArtPath(pageType: KitPage["type"] | null | undefined, tokens: DesignPresetTokens) {
  if (tokens.slug !== "brand" || !pageType || pageType === "cover") {
    return ""
  }

  const pageMap: Partial<Record<KitPage["type"], string>> = {
    "welcome": "02",
    "toc": "03",
    "quote": "04",
    "section-divider": "05",
    "lesson": "06",
    "lesson-continue": "07",
    "reflection": "07",
    "workbook": "08",
    "checklist": "10",
    "progress-check": "10",
    "tracker": "11",
    "notes": "12",
    "action-plan": "13",
    "resource": "14",
    "closing": "14",
    "case-study": "15",
    "back-cover": "16",
  }
  const pageNumber = pageMap[pageType]

  return pageNumber ? `/kit-assets/brand-template/brand-template-${pageNumber}-blank.jpg` : ""
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
  const showRibbon =
    page?.type !== "cover" &&
    page?.type !== "welcome" &&
    page?.type !== "toc" &&
    page?.type !== "section-divider" &&
    !(page?.type === "lesson" && tokens.styleFamily === "brand") &&
    page?.type !== "closing" &&
    page?.type !== "back-cover"
  const isCover = page?.type === "cover"
  const isBrandLesson = page?.type === "lesson" && tokens.styleFamily === "brand"

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
      {isBrandLesson && (
        <>
          <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 font-heading text-[18px] font-semibold tracking-[0.08em]" style={{ color: tokens.ink }}>
            B<span style={{ color: tokens.accent }}>C</span>
          </div>
          <div className="absolute bottom-5 right-7 z-20 text-[8px] font-semibold" style={{ color: tokens.mutedInk }}>
            {total > 0 ? pageNumber : 0} / {total}
          </div>
        </>
      )}
      {!isCover && !isBrandLesson && (
        <div className="absolute bottom-5 left-7 right-7 z-20 flex justify-between border-t border-[var(--preview-line)] pt-3 text-[8px] text-muted-foreground">
          <span>{footer}</span>
          <span>
            {total > 0 ? pageNumber : 0} / {total}
          </span>
        </div>
      )}
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

  if ((page.type as string) === "cover") {
    return <MiniCoverPreview kit={kit} page={page} tokens={tokens} />
  }

  if (page.type === "welcome") {
    return <MiniWelcomePreview page={page} tokens={tokens} />
  }

  if (page.type === "toc") {
    return <MiniTocPreview kit={kit} page={page} tokens={tokens} />
  }

  if (page.type === "section-divider" && tokens.styleFamily === "brand") {
    return <MiniBrandSectionDividerPreview page={page} tokens={tokens} />
  }

  if (page.type === "lesson" && tokens.styleFamily === "brand") {
    return <MiniBrandLessonPreview page={page} tokens={tokens} />
  }

  if (page.type === "quote" && tokens.styleFamily === "brand") {
    return <MiniBrandQuotePreview page={page} tokens={tokens} />
  }

  if ((page.type as string) === "cover") {
    const coverTitle = kit?.title || page.title
    const longCoverTitle = coverTitle.length > 24

    if (tokens.styleFamily === "rise") {
      const collectionTitle = tokens.slug === "meetatheal-rise" ? "Meet at the Heal" : "Rise"
      const collectionLine =
        tokens.slug === "meetatheal-rise"
          ? meetAtHealRiseSubtitle(page, kit)
          : "Come Back To Yourself."
      const riseTagline =
        tokens.slug === "meetatheal-rise"
          ? meetAtHealTagline(page, kit)
          : page.subtitle || kit?.subtitle || page.tagline || kit?.tagline

      return (
        <div className="relative z-10 flex h-[calc(100%-72px)] flex-col items-center px-8 pt-20 text-center">
          <div
            className="font-heading text-[25px] font-semibold leading-none tracking-[0.04em]"
            style={{ color: tokens.accent, textShadow: `0 1px 0 ${tokens.paper}` }}
          >
            BC
          </div>
          <div className="mt-3 text-[8px] font-extrabold uppercase tracking-[0.36em] text-[var(--preview-background)]">
            Best Collective
          </div>
          <div className="my-3 flex items-center gap-2 text-[var(--preview-rose)]">
            <span className="h-px w-8 bg-current" />
            <span className="text-[8px] leading-none">♥</span>
            <span className="h-px w-8 bg-current" />
          </div>
          <div
            className={cn(
              "max-w-[310px] break-words font-heading font-semibold uppercase leading-[0.82] tracking-[0.18em]",
              tokens.slug === "meetatheal-rise" ? "text-[39px] tracking-[0.04em]" : "text-[64px]"
            )}
            style={{
              color: tokens.rose,
              textShadow: `0 1px 0 ${tokens.paper}, 0 3px 10px ${tokens.accentSoft}`,
            }}
          >
            {collectionTitle}
          </div>
          <div className="mt-5 max-w-[260px] text-[8px] font-bold uppercase tracking-[0.36em] text-[var(--preview-background)]">
            {collectionLine}
          </div>
          <div className="mt-6 h-px w-12 bg-[var(--preview-rose)]" />
          <div className="mt-3 max-w-[240px] text-[10px] font-bold uppercase tracking-[0.27em] text-[var(--preview-background)]">
            {previewProductLabel(kit, tokens)}
          </div>
          <div className="mt-3 h-px w-12 bg-[var(--preview-rose)]" />
          <div className="mt-7 text-[16px] leading-none text-[var(--preview-rose)]">♕</div>
          {riseTagline && (
            <div className="absolute bottom-5 left-8 right-8 text-[7px] font-bold uppercase tracking-[0.22em] text-[var(--preview-background)]">
              {riseTagline}
            </div>
          )}
        </div>
      )
    }

    if (tokens.styleFamily === "land") {
      const kitTitle = tokens.slug === "meetatheal-land" ? "Land Individual Workbook" : cleanCoverKitTitle(coverTitle)
      const collectionTitle = tokens.slug === "meetatheal-land" ? "Meet at the Heal" : "Land"
      const collectionLine =
        tokens.slug === "meetatheal-land"
          ? meetAtHealLandSubtitle(page, kit)
          : "Build. Grow. Stand Firm."
      const landTagline =
        tokens.slug === "meetatheal-land"
          ? meetAtHealTagline(page, kit)
          : page.subtitle || kit?.subtitle || page.tagline || kit?.tagline

      return (
        <div className="relative z-10 flex h-[calc(100%-72px)] flex-col items-center px-8 pt-8 text-center">
          <span
            aria-hidden="true"
            className="mb-2 h-5 w-12"
            style={{
              background: tokens.gold,
              clipPath: "polygon(0 85%, 28% 36%, 42% 58%, 58% 18%, 100% 85%, 88% 85%, 58% 42%, 43% 70%, 30% 54%, 12% 85%)",
            }}
          />
          <div className="mb-3 text-[8px] font-extrabold uppercase tracking-[0.36em] text-[var(--preview-background)]">
            Best Collective
          </div>
          <div
            className="max-w-[310px] break-words font-heading text-[60px] font-semibold uppercase leading-[0.86] tracking-[0.12em]"
            style={{ color: tokens.ink }}
          >
            {collectionTitle}
          </div>
          <div className="mt-3 max-w-[250px] text-[8px] font-bold uppercase tracking-[0.34em] text-[var(--preview-background)]">
            {collectionLine}
          </div>
          <div className="my-3 flex items-center gap-2 text-[var(--preview-gold)]">
            <span className="h-px w-10 bg-current" />
            <span className="size-1.5 rotate-45 bg-current" />
            <span className="size-1.5 rotate-45 bg-current" />
            <span className="h-px w-10 bg-current" />
          </div>
          <div className="max-w-[310px] font-heading text-[28px] font-semibold uppercase leading-[0.98] text-[var(--preview-background)]">
            {kitTitle}
          </div>
          <div className="mt-3 bg-[var(--preview-ink)] px-5 py-1.5 text-[8px] font-bold uppercase tracking-[0.24em] text-[var(--preview-paper)] shadow-sm">
            {previewProductLabel(kit, tokens)}
          </div>
          {landTagline && (
            <div className="absolute bottom-2 left-8 right-8 text-[8px] font-bold uppercase tracking-[0.22em] text-[var(--preview-paper)] drop-shadow">
              {landTagline}
            </div>
          )}
        </div>
      )
    }

    if (tokens.styleFamily === "meetatheal") {
      const collectionLine = meetAtHealCoverSubtitle(page, kit)

      return (
        <div className="relative z-10 flex h-[calc(100%-72px)] flex-col items-center px-8 pt-12 text-center">
          <span aria-hidden="true" className="relative mb-3 block size-6 rotate-[-45deg] rounded-sm border-2 border-[var(--preview-rose)]">
            <span className="absolute -top-[13px] left-[-2px] size-6 rounded-full border-2 border-[var(--preview-rose)] bg-transparent" />
            <span className="absolute -right-[13px] top-[-2px] size-6 rounded-full border-2 border-[var(--preview-rose)] bg-transparent" />
          </span>
          <div className="mb-3 text-[8px] font-extrabold uppercase tracking-[0.36em] text-[var(--preview-background)]">
            Best Collective
          </div>
          <div
            className="max-w-[305px] break-words font-heading text-[39px] font-semibold uppercase leading-[0.92] tracking-[0.04em]"
            style={{ color: tokens.ink }}
          >
            Meet at the Heal
          </div>
          <div className="mt-3 max-w-[265px] text-[8px] font-bold uppercase tracking-[0.28em] text-[var(--preview-background)]">
            {collectionLine}
          </div>
          <div className="my-4 flex items-center gap-2 text-[var(--preview-gold)]">
            <span className="h-px w-10 bg-current" />
            <span className="size-1.5 rotate-45 bg-current" />
            <span className="h-px w-10 bg-current" />
          </div>
          <div className="max-w-[230px] text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--preview-background)]">
            {previewProductLabel(kit, tokens)}
          </div>
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
            "max-w-[282px] break-words font-heading font-semibold uppercase leading-[0.9]",
            "text-[38px]",
            tokens.styleFamily === "brand" && "max-w-[318px] text-[42px] leading-[0.86]",
            tokens.styleFamily === "rebuild" && "max-w-[318px] text-[40px] leading-[0.86]",
            longCoverTitle && "max-w-[326px] text-[36px] leading-[0.88]",
            longCoverTitle && tokens.styleFamily === "brand" && "text-[38px] leading-[0.84]",
            longCoverTitle && tokens.styleFamily === "rebuild" && "text-[37px] leading-[0.84]"
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
        <MiniPageHeading page={page} tokens={tokens} />
        <div className="mt-5 rounded-lg border border-[var(--preview-line)] bg-[var(--preview-paper)]/85 p-5 shadow-sm">
          <MiniContent blocks={page.content} />
          {page.tagline && (
            <div className="mt-4 text-[8px] font-bold uppercase tracking-[0.22em] text-[var(--preview-muted)]">
              {page.tagline}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (page.type === "back-cover") {
    return (
      <div className="relative z-10 flex h-[calc(100%-72px)] flex-col items-center justify-center px-8 text-center">
        <div className="font-heading text-[22px] font-semibold tracking-[0.08em]" style={{ color: tokens.ink }}>
          {tokens.icon === "bc" ? "B C" : tokens.shortName}
        </div>
        <div className="mt-4 text-[8px] font-extrabold uppercase tracking-[0.34em] text-[var(--preview-background)]">
          {page.title || "Best Collective"}
        </div>
        <div className="mt-7 max-w-[300px] font-heading text-[38px] font-semibold uppercase leading-[0.92]" style={{ color: tokens.ink }}>
          {page.subtitle || kit?.subtitle || page.title}
        </div>
        {page.tagline && (
          <div className="mt-7 max-w-[250px] text-[8px] font-bold uppercase tracking-[0.26em] text-[var(--preview-muted)]">
            {page.tagline}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative z-10 p-5">
      <MiniPageHeading page={page} tokens={tokens} />
      <MiniContent blocks={page.content} />
      <MiniFillablePreview page={page} />
    </div>
  )
}

function MiniWelcomePreview({
  page,
  tokens,
}: {
  page: KitPage
  tokens: DesignPresetTokens
}) {
  const intro = previewWelcomeIntro(page)
  const benefits = previewWelcomeBenefits(page)

  return (
    <div className="relative z-10 h-[calc(100%-42px)] px-9 pt-12 text-left">
      <div
        className="font-heading text-[42px] font-semibold uppercase leading-none tracking-[0.12em]"
        style={{ color: tokens.ink }}
      >
        WELCOME
      </div>
      {intro && (
        <p className="mt-7 max-w-[280px] text-[11px] font-medium leading-6" style={{ color: tokens.background }}>
          {intro}
        </p>
      )}
      {benefits.length > 0 && (
        <ul className="mt-8 grid max-w-[300px] gap-3.5 text-[10px] font-semibold leading-5" style={{ color: tokens.ink }}>
          {benefits.map((benefit) => (
            <li className="grid grid-cols-[26px_1fr] items-center gap-3" key={benefit}>
              <span
                className="flex size-[26px] items-center justify-center rounded-full border"
                style={{
                  background: tokens.accentSoft,
                  borderColor: tokens.accent,
                  color: tokens.accent,
                }}
              >
                <PreviewWelcomeBenefitIcon tokens={tokens} />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      )}
      <span
        aria-hidden="true"
        className="absolute bottom-12 right-8 size-24 rounded-full border"
        style={{
          background: `radial-gradient(circle at 44% 42%, ${tokens.accent}55 0 12%, transparent 13%), radial-gradient(circle at 64% 62%, ${tokens.lilac}55 0 26%, transparent 27%), radial-gradient(circle at 28% 72%, ${tokens.sage}44 0 22%, transparent 23%)`,
          borderColor: tokens.gold,
        }}
      >
        <span
          className="absolute inset-7 rounded-full border"
          style={{ borderColor: tokens.accent }}
        />
      </span>
    </div>
  )
}

function PreviewWelcomeBenefitIcon({ tokens }: { tokens: DesignPresetTokens }) {
  const accent = tokens.branch === "meetatheal" ? tokens.blue : tokens.gold
  const shared = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }

  if (tokens.branch === "rise") {
    return (
      <svg {...shared}>
        <path d="M12 5c3.2 0 5.8 2.4 5.8 5.4 0 3.9-3 6.5-5.8 7.8-2.8-1.3-5.8-3.9-5.8-7.8C6.2 7.4 8.8 5 12 5Z" />
        <path d="M8.4 11.2c3.4.3 6.6-.8 9.1-3.2" stroke={accent} />
      </svg>
    )
  }

  if (tokens.branch === "land") {
    return (
      <svg {...shared}>
        <path d="M3.5 18.5 8.8 9.7l3 4.2 4-7 4.7 11.6h-17Z" />
        <path d="M8.8 9.7 10.5 14m5.3-7.1 1.1 5.4" stroke={accent} />
      </svg>
    )
  }

  if (tokens.branch === "meetatheal") {
    return (
      <svg {...shared}>
        <path d="M11.5 18.5C6.8 15 4.7 12 5.2 9.4c.6-2.8 4.1-3.5 6.3-.8 2.2-2.7 5.7-2 6.3.8.5 2.6-1.6 5.6-6.3 9.1Z" />
        <path d="M13.2 18.5c4.7-3.5 6.8-6.5 6.3-9.1-.6-2.8-4.1-3.5-6.3-.8" stroke={accent} />
      </svg>
    )
  }

  if (tokens.branch === "rebuild") {
    return (
      <svg {...shared}>
        <path d="M7 19V5h7.2A4.8 4.8 0 0 1 19 9.8V19" />
        <path d="M11 19V8.4h4M4.5 19h15" stroke={accent} />
      </svg>
    )
  }

  return (
    <svg {...shared}>
      <path d="M5.5 15.5h8.7v-7H5.5v7Z" />
      <path d="M4 18h12M9 15.5 8.2 18m4.2-2.5.8 2.5" />
      <path d="M16.2 18c2.1 0 3.6-1.4 3.6-3.8h-5c0 2.4 1.2 3.8 3.4 3.8Z" stroke={accent} />
    </svg>
  )
}

function previewWelcomeIntro(page: KitPage) {
  const paragraph = page.content.find((block) => block.type === "paragraph")

  if (paragraph?.type === "paragraph") {
    return paragraph.text
  }

  return page.subtitle
}

function previewWelcomeBenefits(page: KitPage) {
  const checks = page.content.find((block) => block.type === "check-list")

  if (checks?.type === "check-list") {
    return checks.items.slice(0, 5)
  }

  const list = page.content.find((block) => block.type === "list")

  if (list?.type === "list") {
    return list.items.slice(0, 5)
  }

  return page.checks.slice(0, 5)
}

function MiniTocPreview({
  kit,
  page,
  tokens,
}: {
  kit: ParsedKit | null
  page: KitPage
  tokens: DesignPresetTokens
}) {
  const { mainRows, backMatterRows } = previewTocRows(page, kit)

  return (
    <div className="relative z-10 h-[calc(100%-42px)] px-9 pt-[74px] text-left">
      <div
        className="whitespace-nowrap text-center font-heading text-[28px] font-semibold uppercase leading-none tracking-[0.035em]"
        style={{ color: tokens.ink }}
      >
        TABLE OF CONTENTS
      </div>
      <div className="mx-auto mt-5 flex items-center justify-center gap-2" style={{ color: tokens.accent }}>
        <span className="h-px w-14 bg-current" />
        <span className="size-2 rounded-full bg-current" />
        <span className="h-px w-14 bg-current" />
      </div>
      <div className="mx-auto mt-8 grid max-w-[305px] gap-3.5">
        <PreviewTocRows rows={mainRows} tokens={tokens} />
      </div>
      {backMatterRows.length > 0 && (
        <div className="mx-auto mt-6 grid max-w-[305px] gap-4">
          <PreviewTocRows rows={backMatterRows} tokens={tokens} />
        </div>
      )}
      <span
        aria-hidden="true"
        className="absolute bottom-10 right-6 size-28 rounded-full border"
        style={{ borderColor: tokens.gold }}
      >
        <span className="absolute inset-6 rounded-full border" style={{ borderColor: tokens.accent }} />
        <span
          className="absolute bottom-7 right-5 size-10 rounded-full"
          style={{ background: tokens.lilac, opacity: 0.45 }}
        />
      </span>
    </div>
  )
}

function PreviewTocRows({
  rows,
  tokens,
}: {
  rows: PreviewTocRow[]
  tokens: DesignPresetTokens
}) {
  return (
    <>
      {rows.map((row) => (
        <div
          className="grid grid-cols-[28px_auto_minmax(44px,1fr)_22px] items-baseline gap-2 text-[10px] leading-none"
          key={`${row.number}-${row.title}-${row.pageNumber}`}
          style={{ color: tokens.background }}
        >
          <span className="font-extrabold tracking-[0.08em]" style={{ color: row.number ? tokens.ink : "transparent" }}>
            {row.number}
          </span>
          <span className="truncate font-medium">{row.title}</span>
          <span
            className="min-w-8 translate-y-[-3px] border-b border-dotted"
            style={{ borderColor: tokens.background, opacity: 0.78 }}
          />
          <span className="text-right font-bold" style={{ color: tokens.ink }}>
            {row.pageNumber}
          </span>
        </div>
      ))}
    </>
  )
}

type PreviewTocRow = {
  number: string
  title: string
  pageNumber: string
  backMatter: boolean
}

function previewTocRows(page: KitPage, kit: ParsedKit | null) {
  const items = page.content.flatMap((block) => (block.type === "list" ? block.items : []))
  const pageNumbers = previewTocPageNumbers(kit)
  const rows = items.map((item) => previewParseTocRow(item, pageNumbers))

  return {
    mainRows: rows.filter((row) => !row.backMatter),
    backMatterRows: rows.filter((row) => row.backMatter),
  }
}

function previewParseTocRow(item: string, pageNumbers: Map<string, string>): PreviewTocRow {
  const parts = item.split("|").map((part) => part.trim()).filter(Boolean)
  const hasNumber = parts.length >= 3 || /^\d+\.?$/.test(parts[0] ?? "")
  const number = hasNumber ? (parts[0] ?? "").replace(/\.$/, "") : ""
  const title = hasNumber ? parts[1] ?? item : parts[0] ?? item
  const explicitPage = hasNumber ? parts[2] : parts[1]
  const pageNumber = explicitPage || pageNumbers.get(normalisePreviewTocTitle(title)) || ""

  return {
    number,
    title,
    pageNumber,
    backMatter: !number || /^(resources?|notes?|appendix|references?)$/i.test(title.trim()),
  }
}

function previewTocPageNumbers(kit: ParsedKit | null) {
  const pageNumbers = new Map<string, string>()

  kit?.pages.forEach((kitPage, index) => {
    if (!kitPage.title || kitPage.type === "toc") {
      return
    }

    const key = normalisePreviewTocTitle(kitPage.title)

    if (!pageNumbers.has(key)) {
      pageNumbers.set(key, String(index + 1))
    }
  })

  return pageNumbers
}

function normalisePreviewTocTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(chapter|lesson|section)\s+\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function MiniBrandLessonPreview({
  page,
  tokens,
}: {
  page: KitPage
  tokens: DesignPresetTokens
}) {
  const intro = previewLessonIntro(page)
  const bullets = previewLessonSidebarBullets(page)
  const sections = previewLessonSections(page)
  const takeaway = previewLessonTakeaway(page)

  return (
    <div className="relative z-10 grid h-[calc(100%-42px)] grid-cols-[118px_1fr] grid-rows-[1fr_auto] gap-x-5 gap-y-4 px-8 pb-12 pt-9">
      <aside
        className="rounded border-l-[5px] p-3 shadow-sm"
        style={{
          borderColor: tokens.accent,
          background: `linear-gradient(135deg, ${tokens.lilac}22, transparent 58%), ${tokens.paper}dd`,
          color: tokens.background,
        }}
      >
        <div className="text-[7px] font-extrabold uppercase leading-none tracking-[0.28em]" style={{ color: tokens.accent }}>
          {page.section || "Lesson"}
        </div>
        <div className="mt-4 font-heading text-[21px] font-bold leading-[0.95]" style={{ color: tokens.ink }}>
          {page.title}
        </div>
        {intro && <p className="mt-4 line-clamp-7 text-[8px] font-medium leading-[1.55]">{intro}</p>}
        {bullets.length > 0 && (
          <>
            <div className="mt-4 text-[6px] font-extrabold uppercase tracking-[0.22em]" style={{ color: tokens.accent }}>
              In this lesson
            </div>
            <ul className="mt-2 grid gap-1.5 text-[7px] font-semibold leading-tight">
              {bullets.map((bullet) => (
                <li className="grid grid-cols-[8px_1fr] gap-1.5" key={bullet}>
                  <span className="mt-1 size-1.5 rounded-full" style={{ background: tokens.accent }} />
                  <span className="line-clamp-2">{bullet}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-6 font-heading text-[18px] font-semibold tracking-[0.08em]" style={{ color: tokens.ink }}>
          B<span style={{ color: tokens.accent }}>C</span>
        </div>
      </aside>
      <div className="pt-1">
        {sections.map((section, index) => (
          <div
            className="grid grid-cols-[25px_1fr] gap-3 py-3 first:pt-0"
            style={{ borderTop: index === 0 ? undefined : `1px solid ${tokens.line}` }}
            key={`${section.title}-${index}`}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full text-[8px] font-extrabold"
              style={{
                background: tokens.ink,
                border: `1px solid ${tokens.accent}`,
                color: tokens.paper,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-heading text-[15px] font-bold leading-tight" style={{ color: tokens.ink }}>
                {section.title}
              </div>
              <p className="mt-1 line-clamp-3 text-[8px] font-medium leading-[1.45]" style={{ color: tokens.background }}>
                {section.text}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div
        className="col-span-2 rounded border-l-[5px] p-3 shadow-sm"
        style={{
          borderColor: tokens.accent,
          background: `linear-gradient(90deg, ${tokens.lilac}22, transparent 72%), ${tokens.paperAlt}cc`,
        }}
      >
        <div className="text-[7px] font-extrabold uppercase tracking-[0.26em]" style={{ color: tokens.accent }}>
          Key Takeaway
        </div>
        <div className="mt-1 line-clamp-2 font-heading text-[14px] italic leading-tight" style={{ color: tokens.ink }}>
          {takeaway}
        </div>
      </div>
    </div>
  )
}

type PreviewLessonSection = {
  title: string
  text: string
}

function previewLessonIntro(page: KitPage) {
  const paragraphs = previewLessonTeachingParagraphs(page)

  return paragraphs[0] || page.subtitle
}

function previewLessonSections(page: KitPage): PreviewLessonSection[] {
  const paragraphs = previewLessonTeachingParagraphs(page)
  const structured = paragraphs
    .slice(1)
    .map(splitPreviewLessonSection)
    .filter((section): section is PreviewLessonSection => Boolean(section))
  const bodySources = [
    ...paragraphs.slice(1).filter((paragraph) => !splitPreviewLessonSection(paragraph)),
    page.bottomNote,
    paragraphs[0],
  ].filter((value) => value.trim())

  return Array.from({ length: 3 }).map((_, index) => {
    const section = structured[index]

    return {
      title:
        section?.title ||
        ["Why This Matters", "What To Decide", "How To Use It"][index],
      text:
        section?.text ||
        bodySources[index] ||
        bodySources[0] ||
        page.subtitle ||
        page.title,
    }
  })
}

function previewLessonTakeaway(page: KitPage) {
  const paragraphs = previewLessonParagraphs(page)

  return page.bottomNote || paragraphs.at(-1) || page.subtitle || page.title
}

function previewLessonParagraphs(page: KitPage) {
  return page.content
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text.trim())
    .filter(Boolean)
}

function previewLessonTeachingParagraphs(page: KitPage) {
  return previewLessonParagraphs(page).filter((paragraph) => !/^in this lesson\b/i.test(paragraph))
}

function previewLessonSidebarBullets(page: KitPage) {
  return page.content
    .flatMap((block) => (block.type === "check-list" ? block.items : []))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
}

function splitPreviewLessonSection(text: string): PreviewLessonSection | null {
  const match = text.match(/^(.{3,70}):\s+(.{12,})$/)

  if (!match) {
    return null
  }

  return {
    title: cleanPreviewLessonTitle(match[1]),
    text: match[2].trim().replace(/\s+/g, " "),
  }
}

function cleanPreviewLessonTitle(value = "") {
  return value.trim().replace(/[.:;]+$/g, "")
}

function MiniBrandSectionDividerPreview({
  page,
  tokens,
}: {
  page: KitPage
  tokens: DesignPresetTokens
}) {
  return (
    <div className="relative z-10 flex h-[calc(100%-42px)] items-start justify-center px-9 pt-[104px] text-center">
      <span
        aria-hidden="true"
        className="absolute right-14 top-0 h-20 w-px opacity-70"
        style={{ background: tokens.background }}
      >
        <span
          className="absolute -bottom-8 left-1/2 size-8 -translate-x-1/2 rounded-full border shadow-sm"
          style={{
            borderColor: tokens.accent,
            background: `radial-gradient(circle at 50% 58%, ${tokens.gold}55 0 28%, transparent 29%), ${tokens.paper}`,
          }}
        />
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-5 right-[-18px] z-0 h-12 w-[86px] rotate-[-6deg] rounded border opacity-75 shadow-sm"
        style={{ borderColor: tokens.line, background: tokens.paper }}
      >
        <span className="absolute left-5 right-5 top-5 h-px" style={{ background: tokens.accent }} />
        <span className="absolute left-5 right-5 top-7 h-px opacity-45" style={{ background: tokens.ink }} />
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-[58px] right-4 z-0 h-1.5 w-20 rotate-[-21deg] rounded-full border opacity-75"
        style={{
          background: `linear-gradient(90deg, ${tokens.ink} 0 14%, ${tokens.gold} 15% 28%, ${tokens.paper} 29% 85%, ${tokens.ink} 86%)`,
          borderColor: tokens.line,
        }}
      />
      <div className="relative z-10 max-w-[320px]">
        <div
          className="text-[9px] font-bold uppercase leading-none tracking-[0.36em]"
          style={{ color: tokens.accent }}
        >
          {page.section || "Section"}
        </div>
        <div className="mx-auto mt-5 flex items-center justify-center gap-2" style={{ color: tokens.accent }}>
          <span className="h-px w-12 bg-current" />
          <span className="size-2 rounded-full bg-current" />
          <span className="h-px w-12 bg-current" />
        </div>
        <div
          className="mt-8 font-heading text-[34px] font-semibold uppercase leading-[0.98] tracking-[0.035em]"
          style={{ color: tokens.ink }}
        >
          {page.title}
        </div>
        {page.subtitle && (
          <div className="mx-auto mt-6 max-w-[250px] font-heading text-[17px] italic leading-6" style={{ color: tokens.background }}>
            {page.subtitle}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniBrandQuotePreview({
  page,
  tokens,
}: {
  page: KitPage
  tokens: DesignPresetTokens
}) {
  const quote = previewQuoteBlock(page)

  return (
    <div className="relative z-10 flex h-[calc(100%-42px)] items-start justify-center px-10 pb-8 pt-[96px] text-center">
      <span
        aria-hidden="true"
        className="absolute right-[-14px] top-4 h-14 w-20 rotate-[4deg] rounded-sm shadow-sm"
        style={{ background: tokens.ink }}
      >
        <span className="absolute -bottom-3 -left-1 -right-1 h-2 rounded-sm" style={{ background: tokens.ink, opacity: 0.78 }} />
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-[52px] right-4 h-12 w-[72px] rotate-[-11deg] rounded border shadow-sm"
        style={{ background: tokens.paper, borderColor: tokens.line }}
      >
        <span className="absolute left-4 right-4 top-6 h-px" style={{ background: tokens.accent }} />
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-[88px] right-9 h-1.5 w-20 rotate-[-24deg] rounded-full border"
        style={{
          background: `linear-gradient(90deg, ${tokens.ink} 0 14%, ${tokens.gold} 15% 28%, ${tokens.paper} 29% 85%, ${tokens.ink} 86%)`,
          borderColor: tokens.line,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[118px] right-7 size-14 rounded-full border-[7px] shadow-sm"
        style={{ background: tokens.paper, borderColor: tokens.ink }}
      >
        <span
          className="absolute right-[-15px] top-4 h-6 w-4 rounded-r-full border-4 border-l-0"
          style={{ borderColor: tokens.ink }}
        />
      </span>
      <div className="max-w-[255px]">
        <div className="font-heading text-[50px] font-bold leading-[0.65]" style={{ color: tokens.plum }}>
          &ldquo;
        </div>
        <div className="mx-auto mt-3 flex items-center justify-center gap-2" style={{ color: tokens.accent }}>
          <span className="h-px w-10 bg-current" />
          <span className="size-2 rounded-full bg-current" />
          <span className="h-px w-10 bg-current" />
        </div>
        <blockquote
          className="mt-5 font-heading text-[26px] font-semibold leading-[1.06]"
          style={{ color: tokens.ink }}
        >
          {quote.text}
        </blockquote>
        <div className="mt-8 font-heading text-[23px] font-semibold leading-none" style={{ color: tokens.ink }}>
          B<span style={{ color: tokens.accent }}>C</span>
        </div>
        <div className="mt-3 text-[7px] font-bold uppercase tracking-[0.34em]" style={{ color: tokens.background }}>
          {quote.attribution || "Best Collective"}
        </div>
        <div className="mx-auto mt-3 flex items-center justify-center gap-2" style={{ color: tokens.accent }}>
          <span className="h-px w-8 bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
          <span className="h-px w-8 bg-current" />
        </div>
      </div>
    </div>
  )
}

function previewQuoteBlock(page: KitPage) {
  const quote = page.content.find((block) => block.type === "quote")

  if (quote?.type === "quote") {
    return quote
  }

  return {
    type: "quote" as const,
    text: page.title || "Clarity is the foundation. Strategy is the plan. Systems create freedom.",
    attribution: "Best Collective",
  }
}

function MiniCoverPreview({
  kit,
  page,
  tokens,
}: {
  kit: ParsedKit | null
  page: KitPage
  tokens: DesignPresetTokens
}) {
  const cover = previewCoverData(page, kit, tokens)
  const labelColor = tokens.styleFamily === "brand" ? tokens.ink : tokens.background
  const markColor =
    tokens.branch === "rise" || tokens.branch === "meetatheal"
      ? tokens.rose
      : tokens.branch === "land"
        ? tokens.gold
        : tokens.ink
  const taglineColor = tokens.branch === "land" || tokens.branch === "meetatheal" ? tokens.paper : labelColor

  return (
    <div className="relative z-10 flex h-[calc(100%-42px)] flex-col items-center px-8 pt-9 text-center">
      <div className="font-heading text-[13px] font-semibold uppercase leading-none tracking-[0.3em]" style={{ color: labelColor }}>
        Best Collective
      </div>
      <PreviewBranchCoverMark tokens={tokens} color={markColor} />
      <div
        className={cn(
          "max-w-[318px] whitespace-pre-line break-words font-heading font-semibold uppercase leading-[0.84] tracking-[0.16em]",
          cover.branchTitle.length > 8 ? "text-[39px] leading-[0.92] tracking-[0.045em]" : "text-[60px]"
        )}
        style={{ color: tokens.ink }}
      >
        {cover.branchTitle}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[var(--preview-accent)]">
        <span className="h-px w-9 bg-current" />
        <span className="size-1.5 rotate-45 bg-current" />
        <span className="h-px w-9 bg-current" />
      </div>
      <div
        className={cn(
          "mt-5 max-w-[300px] break-words font-heading text-[27px] font-semibold uppercase leading-[0.98]",
          cover.kitTitle.length > 28 && "text-[23px]"
        )}
        style={{ color: labelColor }}
      >
        {cover.kitTitle}
      </div>
      {cover.subtitle && (
        <div className="mt-4 max-w-[260px] text-[8px] font-bold uppercase leading-4 tracking-[0.28em]" style={{ color: labelColor }}>
          {cover.subtitle}
        </div>
      )}
      <div className="mt-4 max-w-[260px] text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: labelColor }}>
        {cover.productLabel}
      </div>
      <div
        className="absolute bottom-5 left-8 right-8 text-[7px] font-bold uppercase tracking-[0.22em]"
        style={{
          color: taglineColor,
          textShadow:
            tokens.branch === "land" || tokens.branch === "meetatheal"
              ? `0 1px 5px ${tokens.background}`
              : undefined,
        }}
      >
        {cover.tagline}
      </div>
    </div>
  )
}

function PreviewBranchCoverMark({
  tokens,
  color,
}: {
  tokens: DesignPresetTokens
  color: string
}) {
  const accent = tokens.branch === "meetatheal" ? tokens.blue : tokens.gold
  const shared = {
    width: 58,
    height: 42,
    viewBox: "0 0 96 72",
    fill: "none",
    stroke: color,
    strokeWidth: 3.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "my-3",
  }

  if (tokens.branch === "rise") {
    return (
      <svg {...shared}>
        <path d="M48 18c8 0 15 6 15 14 0 10-8 17-15 20-7-3-15-10-15-20 0-8 7-14 15-14Z" />
        <path d="M39 27c6-8 17-8 22 1M37 36c9 1 19-2 25-9M43 49c1 8 1 13-1 17" />
        <path d="M42 58c-10-2-18-8-21-17 9-1 17 4 21 17ZM46 59c10-2 17-9 20-18-9 0-17 6-20 18Z" />
        <path d="M22 25c5-10 14-16 26-16s21 6 26 16" stroke={accent} strokeWidth="1.8" opacity=".78" />
      </svg>
    )
  }

  if (tokens.branch === "land") {
    return (
      <svg {...shared} strokeWidth={3.4}>
        <path d="M14 57 33 31l10 13 15-26 24 39H14Z" />
        <path d="m33 31 5 12m20-25 5 21M24 57c9-5 17-6 26-2 9 4 17 3 26-2" stroke={accent} strokeWidth="2.1" opacity=".82" />
        <path d="M18 50v-8m0 0-5 5m5-5 5 5M78 51v-9m0 0-5 5m5-5 5 5" strokeWidth="2.2" />
      </svg>
    )
  }

  if (tokens.branch === "meetatheal") {
    return (
      <svg {...shared} strokeWidth={3.6}>
        <path d="M45 55C29 43 21 33 23 24c2-9 14-12 22-2 8-10 20-7 22 2 2 9-6 19-22 31Z" />
        <path d="M52 55C68 43 76 33 73 24c-2-9-14-12-22-2" stroke={accent} />
        <path d="M18 35c3-14 14-23 30-23s27 9 30 23" stroke={accent} strokeWidth="1.8" opacity=".52" />
      </svg>
    )
  }

  if (tokens.branch === "rebuild") {
    return (
      <svg {...shared} strokeWidth={3.1}>
        <path d="M31 61V16h24c9 0 16 7 16 16v29" />
        <path d="M44 61V25h13M31 61h47M59 53c0-11 9-20 20-20M79 61V33" stroke={accent} />
        <path d="M18 61h22M22 52c6-2 11-1 16 2M22 43c6 0 11 3 15 8" strokeWidth="2.1" opacity=".72" />
      </svg>
    )
  }

  return (
    <svg {...shared} strokeWidth={3}>
      <path d="M24 46h34V22H24v24Z" />
      <path d="M18 53h47M35 46l-3 7m18-7 3 7" />
      <path d="M67 54c8 0 13-5 13-13H64c0 8 4 13 11 13Z" />
      <path d="M80 43h5c4 0 4 7-2 8" />
      <path d="M65 27h17v12H65V27Z" stroke={accent} />
      <path d="M69 32h9M69 36h5" stroke={accent} strokeWidth="2" />
    </svg>
  )
}

function previewCoverData(page: KitPage, kit: ParsedKit | null, tokens: DesignPresetTokens) {
  const branchTitle = previewCoverBranchTitle(tokens)
  const productLabel = previewProductLabel(kit, tokens)
  const kitTitle = previewCoverKitTitle(page.title || kit?.title || productLabel, branchTitle, productLabel)
  const subtitle = previewCoverSubtitle(page, kit, kitTitle)
  const tagline = page.tagline || kit?.tagline || previewDefaultCoverTagline(tokens)

  return { branchTitle, kitTitle, subtitle, productLabel, tagline }
}

function previewCoverBranchTitle(tokens: DesignPresetTokens) {
  if (tokens.branch === "meetatheal") {
    return "Meet at\nthe Heal"
  }

  if (tokens.branch === "brand") {
    return "Brand"
  }

  if (tokens.branch === "rise") {
    return "Rise"
  }

  if (tokens.branch === "land") {
    return "Land"
  }

  if (tokens.branch === "rebuild") {
    return "Rebuild"
  }

  return "Best Collective"
}

function previewCoverKitTitle(title: string, branchTitle: string, productLabel: string) {
  const branchPlain = branchTitle.replace(/\s+/g, " ").trim()
  const cleaned = cleanCoverKitTitle(title)
    .replace(new RegExp(`^${escapeRegExp(branchPlain)}\\s*[:|-]?\\s*`, "i"), "")
    .replace(/^(lesson guide|workbook|lesson book|couples workbook)\s*[:|-]?\s*/i, "")
    .trim()

  return cleaned || productLabel
}

function previewCoverSubtitle(page: KitPage, kit: ParsedKit | null, kitTitle: string) {
  const subtitle = (page.subtitle || kit?.subtitle || "").trim()

  if (!subtitle || subtitle.toLowerCase() === kitTitle.toLowerCase()) {
    return ""
  }

  return subtitle
}

function previewDefaultCoverTagline(tokens: DesignPresetTokens) {
  if (tokens.branch === "meetatheal") {
    return "Two Worlds. One Choice. A Stronger We."
  }

  if (tokens.branch === "rise") {
    return "Come Back To Yourself."
  }

  if (tokens.branch === "land") {
    return "Build. Grow. Stand Firm."
  }

  if (tokens.branch === "rebuild") {
    return "New Season. New Story. New You."
  }

  return "One System. Five Rooms. All For You."
}

function cleanCoverKitTitle(title: string) {
  return title.replace(/\s+kit$/i, "").trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isMeetAtHealText(value: string) {
  return /two worlds|stronger we|heal|healing|together|relationship|choose us|repair|trust|couples/i.test(value)
}

function isGenericBusinessCoverText(value: string) {
  return /business|brand|offer|system\. five rooms|your brand is your promise/i.test(value)
}

function meetAtHealRiseSubtitle(page: KitPage, kit: ParsedKit | null) {
  const candidate = page.subtitle || kit?.subtitle || ""

  if (/come back|yourself|rise|individual|peace|standards/i.test(candidate) && !isGenericBusinessCoverText(candidate)) {
    return candidate
  }

  return "Come Back To Yourself."
}

function meetAtHealLandSubtitle(page: KitPage, kit: ParsedKit | null) {
  const candidate = page.subtitle || kit?.subtitle || ""

  if (/build|grow|stand firm|land|individual|foundation/i.test(candidate) && !isGenericBusinessCoverText(candidate)) {
    return candidate
  }

  return "Build. Grow. Stand Firm."
}

function meetAtHealTagline(page: KitPage, kit: ParsedKit | null) {
  const candidate = page.tagline || kit?.tagline || ""

  if (isMeetAtHealText(candidate)) {
    return candidate
  }

  return "Two worlds. One choice. A stronger we."
}

function meetAtHealCoverSubtitle(page: KitPage, kit: ParsedKit | null) {
  const candidate = page.subtitle || kit?.subtitle || ""

  if (/two worlds|stronger we|heal|healing|together|relationship/i.test(candidate)) {
    return candidate
  }

  return "Two Worlds. One Choice. A Stronger We."
}

function previewProductLabel(kit: ParsedKit | null, tokens?: DesignPresetTokens) {
  if (tokens?.slug === "meetatheal") {
    if (/lesson\s+book/i.test(kit?.title || "")) {
      return "Lesson Book"
    }

    if (/couples\s+workbook/i.test(kit?.title || "")) {
      return "Couples Workbook"
    }
  }

  if (tokens?.slug === "meetatheal-rise") {
    return "Rise Individual Workbook"
  }

  if (tokens?.slug === "meetatheal-land") {
    return "Land Individual Workbook"
  }

  if (kit?.outputMode === "split") {
    return "Lesson Guide + Workbook"
  }

  return (kit?.productType || "workbook")
    .replace(/-/g, " + ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function MiniPageHeading({
  page,
  tokens,
}: {
  page: KitPage
  tokens: DesignPresetTokens
}) {
  const isRebuild = tokens.styleFamily === "rebuild"
  const titleStyle = isRebuild
    ? {
        color: page.type === "notes" ? tokens.rose : tokens.blue,
      }
    : undefined

  return (
    <>
      <div
        className="text-[8px] font-bold uppercase tracking-[0.28em] text-primary"
        style={isRebuild ? { color: tokens.rose } : undefined}
      >
        {page.section || page.rawType}
      </div>
      <div
        className={cn(
          "mt-2 font-heading text-lg font-semibold leading-tight text-[var(--preview-ink)]",
          isRebuild && "uppercase tracking-[0.03em]",
          isRebuild && page.type === "notes" && "normal-case italic"
        )}
        style={titleStyle}
      >
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
  canMarkReady,
  copyFallbackText,
  designLabel,
  exportFiles,
  isCheckingStorage,
  isLoadingExports,
  isWorking,
  onCheckStorage,
  onCopyAllExports,
  onCopyExport,
  onCopyLatestExport,
  onCopyStorageSetupSql,
  onDownloadFillable,
  onDownloadMockup,
  onDownloadPdf,
  onDownloadWorkbookPdf,
  onMarkReadyToSell,
  onRefreshExports,
  product,
  progressValue,
  status,
  storageHealth,
}: {
  branchLabel: string
  canMarkReady: boolean
  copyFallbackText: string
  designLabel: string
  exportFiles: ExportFileSummary[]
  isCheckingStorage: boolean
  isLoadingExports: boolean
  isWorking: boolean
  onCheckStorage: () => void
  onCopyAllExports: () => void
  onCopyExport: (file: ExportFileSummary) => void
  onCopyLatestExport: () => void
  onCopyStorageSetupSql: () => void
  onDownloadFillable: () => void
  onDownloadMockup: () => void
  onDownloadPdf: () => void
  onDownloadWorkbookPdf: () => void
  onMarkReadyToSell: () => void
  onRefreshExports: () => void
  product: ReadyProductSummary | null
  progressValue: number
  status: BuildStatus
  storageHealth: StorageHealthSummary | null
}) {
  const productIsLive = product?.productStatus === "live"
  const productExportName = friendlyExportName(product?.exportUrl ?? "")
  const productUsesLocalFallback = isLocalFallbackExportUrl(product?.exportUrl ?? "")
  const localFallbackCount = exportFiles.filter((file) => isLocalFallbackExportUrl(file.fileUrl)).length
  const publicExportCount = exportFiles.filter((file) => isPublicExportUrl(file.fileUrl)).length

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
          <Alert className="border-primary/30 bg-primary/5">
            <AlertCircleIcon />
            <AlertTitle>Export runtime</AlertTitle>
            <AlertDescription>
              Use the local app to generate final files. When Supabase Storage is ready,
              saved exports also store public links in Export History.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">Supabase Storage</div>
                <Badge variant={storageHealth?.ok ? "secondary" : "outline"}>
                  {storageHealth ? storageHealthStatusLabel(storageHealth) : "Not checked"}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {storageHealth
                  ? storageHealthMessage(storageHealth)
                  : "Check whether exported files can become real public links."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!storageHealth?.ok && (
                <Button
                  disabled={isCheckingStorage}
                  onClick={onCopyStorageSetupSql}
                  size="sm"
                  variant="ghost"
                >
                  <CopyIcon data-icon="inline-start" />
                  Copy Setup SQL
                </Button>
              )}
              <Button
                disabled={isCheckingStorage}
                onClick={onCheckStorage}
                size="sm"
                variant="outline"
              >
                {isCheckingStorage ? (
                  <LoaderCircleIcon data-icon="inline-start" />
                ) : storageHealth?.ok ? (
                  <CheckCircle2Icon data-icon="inline-start" />
                ) : (
                  <RefreshCwIcon data-icon="inline-start" />
                )}
                Check Storage
              </Button>
            </div>
          </div>

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

          <Separator />

          <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="font-medium">Ready to sell</div>
              <div className="text-xs text-muted-foreground">
                {productIsLive
                  ? "Linked Product is live"
                  : "Creates or updates the linked Products record"}
              </div>
              {product ? (
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Product status:</span>{" "}
                    {product.productStatus || "unknown"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Product id:</span>{" "}
                    {shortProductId(product.productId)}
                  </div>
                  <div className="truncate">
                    <span className="font-medium text-foreground">Export used:</span>{" "}
                    {productExportName || "export pending"}{" "}
                    {product?.exportUrl && (
                      <Badge
                        className="align-middle"
                        variant={productUsesLocalFallback ? "destructive" : "secondary"}
                      >
                        {exportLinkKindLabel(product.exportUrl)}
                      </Badge>
                    )}
                  </div>
                  {productUsesLocalFallback && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                      This Product is linked to a local fallback file, not a public sale link yet.
                      Finish Supabase Storage before using it on a live sales page.
                    </div>
                  )}
                  {product.reusedProduct && (
                    <div className="text-primary">Existing Product reused to prevent duplicates.</div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  {publicExportCount > 0
                    ? "No linked Product yet. Public export is ready for product creation."
                    : localFallbackCount > 0
                      ? "No public export link yet. Current saved exports are local fallbacks until Supabase Storage is ready."
                      : "No linked Product yet. Generate a public export, then mark the kit ready."}
                </div>
              )}
            </div>
            <Button
              disabled={isWorking || !canMarkReady}
              onClick={onMarkReadyToSell}
              variant="outline"
            >
              {isWorking ? (
                <LoaderCircleIcon data-icon="inline-start" />
              ) : (
                <CheckCircle2Icon data-icon="inline-start" />
              )}
              {productIsLive ? "Update Product" : "Mark Ready"}
            </Button>
          </div>

          <Separator />

          <ExportHistoryPanel
            files={exportFiles}
            copyFallbackText={copyFallbackText}
            isLoading={isLoadingExports}
            onCopyAll={onCopyAllExports}
            onCopyFile={onCopyExport}
            onCopyLatest={onCopyLatestExport}
            onRefresh={onRefreshExports}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ExportHistoryPanel({
  copyFallbackText,
  files,
  isLoading,
  onCopyAll,
  onCopyFile,
  onCopyLatest,
  onRefresh,
}: {
  copyFallbackText: string
  files: ExportFileSummary[]
  isLoading: boolean
  onCopyAll: () => void
  onCopyFile: (file: ExportFileSummary) => void
  onCopyLatest: () => void
  onRefresh: () => void
}) {
  const hasExports = files.length > 0

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-primary" />
          <div>
            <div className="font-medium">Export History</div>
            <div className="text-xs text-muted-foreground">
              {hasExports ? `${files.length} saved file${files.length === 1 ? "" : "s"}` : "No saved files yet"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isLoading} onClick={onRefresh} size="sm" variant="outline">
            {isLoading ? (
              <LoaderCircleIcon data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            Refresh
          </Button>
          <Button disabled={!hasExports} onClick={onCopyLatest} size="sm" variant="outline">
            <CopyIcon data-icon="inline-start" />
            Copy Latest
          </Button>
          <Button disabled={!hasExports} onClick={onCopyAll} size="sm" variant="outline">
            <CopyIcon data-icon="inline-start" />
            Copy All
          </Button>
        </div>
      </div>

      {hasExports ? (
        <div className="grid gap-2">
          {files.slice(0, 8).map((file) => {
            const hasLocalFallbackLink = isLocalFallbackExportUrl(file.fileUrl)

            return (
              <div
                className="grid gap-2 rounded-md border bg-card/50 p-2 text-sm md:grid-cols-[minmax(0,1fr)_auto]"
                data-testid={`export-history-row-${file.fileType}`}
                key={file.id}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium" data-testid={`export-history-filename-${file.fileType}`}>
                    {file.filename}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid={`export-history-type-${file.fileType}`}>
                      {prettyExportType(file.fileType)}
                    </span>
                    <span data-testid={`export-history-status-${file.fileType}`}>
                      {file.status}
                    </span>
                    <span data-testid={`export-history-date-${file.fileType}`}>
                      {formatExportDate(file.createdAt)}
                    </span>
                    <Badge variant={hasLocalFallbackLink ? "destructive" : "secondary"}>
                      {exportLinkKindLabel(file.fileUrl)}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={() => onCopyFile(file)}
                  size="sm"
                  variant="ghost"
                >
                  <CopyIcon data-icon="inline-start" />
                  Copy
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Generate a PDF, workbook, fillable file, mockup, or ZIP to save its link here.
        </div>
      )}

      {copyFallbackText && (
        <div className="grid gap-2">
          <div className="text-xs font-medium text-muted-foreground">Copy-ready text</div>
          <Textarea
            aria-label="Copy-ready text"
            className="h-20 resize-none font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={copyFallbackText}
          />
        </div>
      )}
    </div>
  )
}

function prettyExportType(value: string) {
  return value
    .split(":")
    .map((part) => part.replace(/-/g, " "))
    .join(" / ")
}

function formatExportDate(value: string) {
  if (!value) {
    return "No date"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function productSummaryFromPayload(payload: {
  exportUrl?: string
  productExportUrl?: string
  productId?: string
  productStatus?: string
  reusedProduct?: boolean
}) {
  if (!payload.productId) {
    return null
  }

  return {
    exportUrl: payload.exportUrl || payload.productExportUrl || "",
    productId: payload.productId,
    productStatus: payload.productStatus || "",
    reusedProduct: payload.reusedProduct,
  }
}

function buildStatusFromSavedKit(payload: Pick<SavedKitLoadResult, "productStatus" | "status">): BuildStatus {
  const savedStatus = payload.status.toLowerCase()
  const productStatus = payload.productStatus.toLowerCase()

  if (savedStatus === "ready_to_sell" || savedStatus === "live" || productStatus === "live") {
    return "Ready to Sell"
  }

  return "Preview Ready"
}

function shortProductId(value: string) {
  if (!value) {
    return "pending"
  }

  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function storageHealthStatusLabel(value: StorageHealthSummary) {
  if (value.ok) {
    return "Public links ready"
  }

  if (value.step === "bucket") {
    return "Bucket missing"
  }

  if (value.step === "public-read" || value.step === "public-bucket") {
    return "Public link blocked"
  }

  if (value.step === "upload") {
    return "Upload blocked"
  }

  return "Needs setup"
}

function storageHealthMessage(value: StorageHealthSummary) {
  if (value.ok) {
    return `Bucket ${value.bucket} can upload files and open public links.`
  }

  if (value.issue) {
    return value.issue
  }

  if (value.step === "public-read") {
    return "The test file uploaded, but its public link did not open outside the app."
  }

  return `Storage check stopped at ${value.step}.`
}

function isLocalFallbackExportUrl(value: string) {
  return value.startsWith("kit-factory-download://")
}

function isPublicExportUrl(value: string) {
  if (!value || isLocalFallbackExportUrl(value)) {
    return false
  }

  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function exportLinkKindLabel(value: string) {
  if (!value) {
    return "No link"
  }

  return isLocalFallbackExportUrl(value) ? "Local fallback" : "Public link"
}

function copyExportSuccessMessage(file: ExportFileSummary | undefined, publicLinkMessage: string) {
  if (file && isLocalFallbackExportUrl(file.fileUrl)) {
    return "Local fallback copied. Supabase Storage is still needed for public links."
  }

  return publicLinkMessage
}

function friendlyExportName(value: string) {
  if (!value) {
    return ""
  }

  if (value.startsWith("kit-factory-download://")) {
    return value.replace("kit-factory-download://", "")
  }

  try {
    const filename = new URL(value).pathname.split("/").filter(Boolean).at(-1)

    return filename ? decodeURIComponent(filename) : value
  } catch {
    return value
  }
}

async function writeClipboardText(value: string) {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.left = "0"
  textarea.style.top = "0"
  textarea.style.width = "1px"
  textarea.style.height = "1px"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, value.length)

  const copied = document.execCommand("copy")
  textarea.remove()

  if (!copied) {
    throw new Error("Copy command failed.")
  }
}

function filenameFromResponse(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition")
  const match = disposition?.match(/filename="([^"]+)"/)

  return match?.[1] ?? fallback
}

function createNewKitMarkdown({
  branch,
  designPreset,
  outputMode,
}: {
  branch: string
  designPreset: string
  outputMode: OutputMode
}) {
  return `---
title: Untitled Kit
subtitle: Add your kit promise here.
branch: ${branch}
design_preset: ${designPreset}
product_type: workbook
output_mode: ${outputMode}
author: Best Collective
tagline: Add your closing promise here.
slug: untitled-kit
---

<!-- PAGE: cover -->
TITLE: Untitled Kit
SUBTITLE: Add your kit promise here.
TAGLINE: Add your closing promise here.
ICON: branch-default

<!-- PAGE: welcome -->
TITLE: Welcome
Add a short welcome paragraph for this kit.

CHECK: Add the first outcome.
CHECK: Add the second outcome.
CHECK: Add the third outcome.

<!-- PAGE: closing -->
SECTION: Closing
TITLE: Your Next Step
Add a short next-step paragraph here.

CHECK: Add the first next step.
CHECK: Add the second next step.

TAGLINE: Add your final reminder here.

<!-- PAGE: back-cover -->
TITLE: You did the work
SUBTITLE: Add a closing note here.
TAGLINE: Add your final brand promise here.
`
}

async function readApiErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload
  } catch {
    return {}
  }
}

function errorMessageFromPayload(payload: ApiErrorPayload, validationFallback: string) {
  if (payload.issues?.length) {
    return validationFallback
  }

  return payload.error || payload.detail || "The file could not be generated."
}

function packageKeyFromFilename(filename: string): PackageKey | null {
  const normalized = filename.toLowerCase().replace(/[_-]+/g, " ")

  if (/\brise\b|individual\s+rise|her\s+workbook|women|woman/.test(normalized)) {
    return "riseWorkbook"
  }

  if (/\bland\b|individual\s+land|his\s+workbook|men|man/.test(normalized)) {
    return "landWorkbook"
  }

  if (/couples?|shared|together|partner/.test(normalized)) {
    return "couplesWorkbook"
  }

  if (/lesson|guide|teaching/.test(normalized)) {
    return "lessonBook"
  }

  return null
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

SECTION: Closing
TITLE: Your Next Step
Come back to the lesson, name one honest action, and decide how you will protect the progress you made.

CHECK: Choose one action before closing this workbook.
CHECK: Return to this work before the next conversation.

TAGLINE: We choose us, every day.

<!-- PAGE: back-cover -->

TITLE: Meet at the Heal
SUBTITLE: Two Worlds. One Choice. A Stronger We.
TAGLINE: We choose us, every day.
ICON: branch-default
IMAGE_SLOT: closing-lifestyle
`
}
