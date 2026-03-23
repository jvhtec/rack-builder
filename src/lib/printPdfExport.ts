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
const EXPORT_IGNORE_SELECTORS = ['.layout-print-toolbar', '[data-pdf-export-ignore="true"]']
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
    ? Math.max(1, Math.min(4, args.devicePixelRatio))
    : 1

  // Target high-definition output: 3x on desktop, 2.5x on mobile.
  // Falls back to progressively lower scales if the device runs out of memory.
  const startScale = args.isMobile
    ? Math.min(2.8, Math.max(2, normalizedDpr * 1.4))
    : Math.min(3.5, Math.max(2.8, normalizedDpr * 1.4))

  const fallbackSeed = args.isMobile
    ? [startScale, 2.5, 2.2, 2, 1.8, 1.6, 1.4]
    : [startScale, 3, 2.8, 2.5, 2.2, 2, 1.8]

  const deduped = Array.from(
    new Set(
      fallbackSeed
        .map((value) => Number(value.toFixed(2)))
        .filter((value) => value >= 1.4 && value <= 4),
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

function isIosDevice(): boolean {
  return /iP(ad|hone|od)/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function shouldIgnorePdfCloneElement(element: Element): boolean {
  return EXPORT_IGNORE_SELECTORS.some((selector) => element.matches(selector))
}

/**
 * Convert an oklab() color value to an rgb()/rgba() string that html2canvas
 * can parse.  Returns `null` when the input cannot be understood.
 *
 * Accepts the inner arguments of `oklab(...)`, e.g.:
 *   "0.5 0.02 -0.03"          → rgb(...)
 *   "50% 0.02 -0.03 / 0.8"   → rgba(... , 0.8)
 *   "17.7638% -2.23517e-8 0/.3" → rgba(... , 0.3)
 */
function oklabToRgba(inner: string): string | null {
  const parts = inner.trim().split('/')
  const tokens = parts[0].trim().split(/\s+/)
  if (tokens.length < 3) return null

  let L = parseFloat(tokens[0])
  const a = parseFloat(tokens[1])
  const b = parseFloat(tokens[2])
  if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return null

  if (tokens[0].endsWith('%')) L /= 100

  // OKLab → linear-light sRGB (via LMS intermediary)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  const rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  const gamma = (c: number): number => {
    const v = Math.max(0, Math.min(1, c))
    return Math.round(
      (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255,
    )
  }

  const ri = gamma(rLin)
  const gi = gamma(gLin)
  const bi = gamma(bLin)

  const alphaPart = parts[1]?.trim()
  if (alphaPart !== undefined && alphaPart !== '') {
    const alphaVal = parseFloat(alphaPart)
    if (Number.isFinite(alphaVal)) return `rgba(${ri}, ${gi}, ${bi}, ${alphaVal})`
  }

  return `rgb(${ri}, ${gi}, ${bi})`
}

/**
 * Rewrite CSS text so that html2canvas (which does not understand OKLab /
 * `color-mix`) can render the document.
 *
 * 1. Strips `@supports` blocks that upgrade hex fallbacks to `color-mix(in oklab …)`.
 * 2. Converts bare `oklab(…)` values to `rgb()`/`rgba()`.
 * 3. Simplifies gradient interpolation hints (`to bottom in oklab` → `to bottom`).
 */
function rewriteOklabInCss(css: string): string {
  if (!css.includes('oklab')) return css

  // 1. Remove @supports blocks that wrap color-mix(in oklab …) overrides.
  //    Tailwind v4 always emits a hex fallback *before* these blocks, so
  //    dropping them is safe.
  css = css.replace(
    /@supports\s*\([^)]*color-mix[^)]*\)\s*\{[^{}]*\{[^}]*\}\s*\}/g,
    '',
  )

  // 2. Replace bare oklab() values with sRGB equivalents.
  css = css.replace(/oklab\(([^)]+)\)/g, (_match, args: string) => {
    return oklabToRgba(args) ?? `rgb(0, 0, 0)`
  })

  // 3. Strip "in oklab" from gradient position strings.
  css = css.replace(
    /\b(to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?)\s+in\s+oklab\b/g,
    '$1',
  )

  return css
}

/**
 * Walk all `<style>` elements and inline `style` attributes in the cloned
 * document, converting any oklab-based colors to sRGB so that html2canvas
 * can parse them.
 */
function neutralizeOklabColors(documentClone: Document): void {
  for (const styleEl of Array.from(documentClone.querySelectorAll('style'))) {
    const text = styleEl.textContent ?? ''
    if (!text.includes('oklab')) continue
    styleEl.textContent = rewriteOklabInCss(text)
  }

  for (const el of Array.from(documentClone.querySelectorAll<HTMLElement>('[style]'))) {
    const style = el.getAttribute('style') ?? ''
    if (!style.includes('oklab')) continue
    el.setAttribute('style', rewriteOklabInCss(style))
  }
}

function prunePdfClone(documentClone: Document, clonedSheet: HTMLElement) {
  const clonedRoot = clonedSheet.closest(`.${EXPORT_ROOT_CLASS}`) ?? documentClone
  clonedRoot.querySelectorAll(EXPORT_IGNORE_SELECTORS.join(', ')).forEach((node) => node.remove())
  neutralizeOklabColors(documentClone)
}

async function triggerPdfDownload(blob: Blob, fileName: string): Promise<void> {
  // Web Share API requires a recent user activation. After a long async
  // render pipeline the gesture is typically expired, so we skip it and
  // go straight to the most reliable download path per platform.
  const ios = isIosDevice()

  // Strategy 1 (non-iOS): anchor with download attribute — universally
  // supported on Chrome, Firefox, Edge, and desktop Safari 14.1+.
  if (!ios && 'download' in HTMLAnchorElement.prototype) {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return
  }

  // Strategy 2 (iOS): open the PDF blob in the current tab. iOS Safari
  // blocks window.open and target=_blank from async contexts, but
  // navigating the current location to a blob URL works reliably and
  // triggers the native iOS PDF viewer with its built-in share/save.
  if (ios) {
    const objectUrl = URL.createObjectURL(blob)
    // Attempt Web Share first — it works on iOS 15+ when user activation
    // hasn't expired. We try it but don't rely on it.
    const file = new File([blob], fileName, { type: 'application/pdf' })
    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: fileName })
        URL.revokeObjectURL(objectUrl)
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          URL.revokeObjectURL(objectUrl)
          return
        }
        // Web Share failed (likely expired gesture) — fall through
      }
    }

    // Navigate to the blob URL. This opens the iOS PDF viewer inline,
    // where the user can tap the share icon to save/send the file.
    window.location.href = objectUrl
    // Don't revoke immediately — the navigation needs the URL alive.
    return
  }

  // Strategy 3 (fallback): open in new tab for other platforms
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.target = '_blank'
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/**
 * Compute the pixel dimensions for rasterising sheets at ~2× screen density.
 * The long side is 1400px (matching the A-series √2 ratio), flipped for portrait.
 */
const EXPORT_LONG_SIDE_PX = 1400
const EXPORT_SHORT_SIDE_PX = 990

export function getExportSheetSizePx(orientation: PdfOrientation): { widthPx: number; heightPx: number } {
  if (orientation === 'portrait') {
    return { widthPx: EXPORT_SHORT_SIDE_PX, heightPx: EXPORT_LONG_SIDE_PX }
  }
  return { widthPx: EXPORT_LONG_SIDE_PX, heightPx: EXPORT_SHORT_SIDE_PX }
}

const ORIENTATION_CLASS_LANDSCAPE = 'layout-print-exporting-landscape'
const ORIENTATION_CLASS_PORTRAIT = 'layout-print-exporting-portrait'

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
  const { widthPx, heightPx } = getExportSheetSizePx(orientation)

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
      width: widthPx,
      height: heightPx,
      ignoreElements: shouldIgnorePdfCloneElement,
      onclone: (documentClone, clonedSheet) => {
        prunePdfClone(documentClone, clonedSheet)
      },
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      logging: false,
      removeContainer: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: widthPx,
      windowHeight: heightPx,
    })

    if (index > 0) {
      pdf.addPage([pageSizeMm.widthMm, pageSizeMm.heightMm], orientation)
    }

    // PNG preserves crisp text and line art for high-definition output.
    const imageData = canvas.toDataURL('image/png')
    pdf.addImage(imageData, 'PNG', 0, 0, pageSizeMm.widthMm, pageSizeMm.heightMm)
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

  const orientationClass =
    orientation === 'portrait' ? ORIENTATION_CLASS_PORTRAIT : ORIENTATION_CLASS_LANDSCAPE

  const hadExportRootClass = rootElement.classList.contains(EXPORT_ROOT_CLASS)
  const hadForceLightClass = document.documentElement.classList.contains(FORCE_LIGHT_CLASS)
  const hadDarkClass = document.documentElement.classList.contains('dark')
  if (!hadExportRootClass) rootElement.classList.add(EXPORT_ROOT_CLASS)
  rootElement.classList.add(orientationClass)
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

        await triggerPdfDownload(pdfBlob, normalizedFileName)
        return
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(`PDF export failed after quality fallback attempts. ${toErrorMessage(lastError)}`)
  } finally {
    if (hadDarkClass) document.documentElement.classList.add('dark')
    rootElement.classList.remove(orientationClass)
    if (!hadExportRootClass) rootElement.classList.remove(EXPORT_ROOT_CLASS)
    if (!hadForceLightClass) document.documentElement.classList.remove(FORCE_LIGHT_CLASS)
  }
}
