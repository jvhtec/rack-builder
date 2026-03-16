export type PdfFormat = 'a3'
export type PdfOrientation = 'landscape' | 'portrait'
export type PdfQualityMode = 'balanced'

export interface PdfExportProgress {
  phase: 'preparing' | 'rendering' | 'assembling' | 'downloading'
  page: number
  totalPages: number
  message: string
}

export interface ExportPrintSheetsToPdfOptions {
  rootElement: HTMLElement
  fileName: string
  format?: PdfFormat
  orientation?: PdfOrientation
  qualityMode?: PdfQualityMode
  onProgress?: (progress: PdfExportProgress) => void
}

interface PageSizeMm {
  widthMm: number
  heightMm: number
}

const EXPORT_ROOT_CLASS = 'layout-print-exporting'
const FORCE_LIGHT_CLASS = 'layout-print-force-light'
const SHEET_SELECTOR = '.layout-print-sheet'
const DEFAULT_FILE_NAME = 'rack-builder-export.pdf'
let pdfLibrariesPromise: Promise<{
  html2canvas: typeof import('html2canvas').default
  jsPDF: typeof import('jspdf').jsPDF
}> | null = null

export function sanitizePdfFilename(input: string): string {
  const withoutExtension = input.trim().replace(/\.pdf$/i, '')
  const strippedControls = Array.from(withoutExtension)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')

  const cleaned = strippedControls
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const baseName = (cleaned || DEFAULT_FILE_NAME.replace(/\.pdf$/i, '')).slice(0, 120)
  return `${baseName}.pdf`
}

export function getPdfPageSizeMm(format: PdfFormat, orientation: PdfOrientation): PageSizeMm {
  if (format !== 'a3') {
    throw new Error(`Unsupported PDF format: ${format}`)
  }

  const shortSideMm = 297
  const longSideMm = 420
  if (orientation === 'landscape') {
    return { widthMm: longSideMm, heightMm: shortSideMm }
  }

  return { widthMm: shortSideMm, heightMm: longSideMm }
}

export function isLikelyMobileDevice(viewportWidth: number, userAgent: string): boolean {
  if (viewportWidth <= 900) return true
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

export function getBalancedScaleCandidates(args: {
  isMobile: boolean
  devicePixelRatio: number
}): number[] {
  const normalizedDpr = Number.isFinite(args.devicePixelRatio)
    ? Math.max(1, Math.min(3, args.devicePixelRatio))
    : 1

  const startScale = args.isMobile
    ? Math.min(2.2, Math.max(1.6, normalizedDpr * 1.35))
    : Math.min(2.8, Math.max(2.1, normalizedDpr * 1.2))

  const fallbackSeed = args.isMobile
    ? [startScale, 2, 1.8, 1.6, 1.4, 1.25]
    : [startScale, 2.6, 2.3, 2.1, 1.9, 1.75, 1.5]

  const deduped = Array.from(
    new Set(
      fallbackSeed
        .map((value) => Number(value.toFixed(2)))
        .filter((value) => value >= 1.25 && value <= 3),
    ),
  )

  deduped.sort((a, b) => b - a)
  return deduped
}

async function waitForFontsAndPaint(): Promise<void> {
  if ('fonts' in document) {
    try {
      await document.fonts.ready
    } catch {
      // Font loading failures should not block export.
    }
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Failed to export PDF.'
}

function triggerPdfDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const canUseDownloadAttribute = 'download' in HTMLAnchorElement.prototype
  const isIosSafariLike = /iP(ad|hone|od)/i.test(navigator.userAgent)

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.rel = 'noopener'
  anchor.style.display = 'none'

  document.body.appendChild(anchor)

  try {
    if (canUseDownloadAttribute && !isIosSafariLike) {
      anchor.download = fileName
      anchor.click()
      return
    }

    anchor.target = '_blank'
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  }
}

async function renderAtScale({
  sheets,
  scale,
  pageSizeMm,
  orientation,
  onProgress,
}: {
  sheets: HTMLElement[]
  scale: number
  pageSizeMm: PageSizeMm
  orientation: PdfOrientation
  onProgress?: (progress: PdfExportProgress) => void
}): Promise<Blob> {
  const { html2canvas, jsPDF } = await loadPdfLibraries()

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageSizeMm.widthMm, pageSizeMm.heightMm],
    compress: true,
    putOnlyUsedFonts: true,
  })

  for (let index = 0; index < sheets.length; index += 1) {
    const pageNumber = index + 1
    onProgress?.({
      phase: 'rendering',
      page: pageNumber,
      totalPages: sheets.length,
      message: `Rendering page ${pageNumber} of ${sheets.length}...`,
    })

    const canvas = await html2canvas(sheets[index], {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      logging: false,
      removeContainer: true,
      scrollX: 0,
      scrollY: 0,
    })

    if (index > 0) {
      pdf.addPage([pageSizeMm.widthMm, pageSizeMm.heightMm], orientation)
    }

    const imageData = canvas.toDataURL('image/jpeg', 0.96)
    pdf.addImage(imageData, 'JPEG', 0, 0, pageSizeMm.widthMm, pageSizeMm.heightMm, undefined, 'FAST')
    canvas.width = 1
    canvas.height = 1
  }

  onProgress?.({
    phase: 'assembling',
    page: sheets.length,
    totalPages: sheets.length,
    message: 'Finalizing PDF...',
  })

  return pdf.output('blob')
}

async function loadPdfLibraries() {
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = Promise.all([import('html2canvas'), import('jspdf')]).then(
      ([html2canvasModule, jsPdfModule]) => ({
        html2canvas: html2canvasModule.default,
        jsPDF: jsPdfModule.jsPDF,
      }),
    )
  }

  return pdfLibrariesPromise
}

export async function exportPrintSheetsToPdf({
  rootElement,
  fileName,
  format = 'a3',
  orientation = 'landscape',
  qualityMode = 'balanced',
  onProgress,
}: ExportPrintSheetsToPdfOptions): Promise<void> {
  const sheets = Array.from(rootElement.querySelectorAll<HTMLElement>(SHEET_SELECTOR))
  if (sheets.length === 0) {
    throw new Error('No printable sheets found on this page.')
  }

  const normalizedFileName = sanitizePdfFilename(fileName)
  const pageSizeMm = getPdfPageSizeMm(format, orientation)
  const isMobile = isLikelyMobileDevice(window.innerWidth, navigator.userAgent)

  const scales =
    qualityMode === 'balanced'
      ? getBalancedScaleCandidates({
          isMobile,
          devicePixelRatio: window.devicePixelRatio || 1,
        })
      : [2]

  const hadExportRootClass = rootElement.classList.contains(EXPORT_ROOT_CLASS)
  const hadForceLightClass = document.documentElement.classList.contains(FORCE_LIGHT_CLASS)
  const hadDarkClass = document.documentElement.classList.contains('dark')
  if (!hadExportRootClass) rootElement.classList.add(EXPORT_ROOT_CLASS)
  if (!hadForceLightClass) document.documentElement.classList.add(FORCE_LIGHT_CLASS)
  if (hadDarkClass) document.documentElement.classList.remove('dark')

  try {
    onProgress?.({
      phase: 'preparing',
      page: 0,
      totalPages: sheets.length,
      message: 'Preparing export...',
    })

    await waitForFontsAndPaint()

    let lastError: unknown = null
    for (const scale of scales) {
      try {
        const pdfBlob = await renderAtScale({
          sheets,
          scale,
          pageSizeMm,
          orientation,
          onProgress,
        })

        onProgress?.({
          phase: 'downloading',
          page: sheets.length,
          totalPages: sheets.length,
          message: 'Downloading PDF...',
        })

        triggerPdfDownload(pdfBlob, normalizedFileName)
        return
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(`PDF export failed after quality fallback attempts. ${toErrorMessage(lastError)}`)
  } finally {
    if (hadDarkClass) document.documentElement.classList.add('dark')
    if (!hadExportRootClass) rootElement.classList.remove(EXPORT_ROOT_CLASS)
    if (!hadForceLightClass) document.documentElement.classList.remove(FORCE_LIGHT_CLASS)
  }
}
