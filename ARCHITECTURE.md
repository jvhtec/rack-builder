# ARCHITECTURE

Comprehensive architecture documentation for **Rack Builder** — a professional AV/IT rack layout planning and visualization application.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [High-Level System Diagram](#2-high-level-system-diagram)
3. [Core Components](#3-core-components)
4. [Data Stores](#4-data-stores)
5. [External Integrations](#5-external-integrations)
6. [Deployment & Infrastructure](#6-deployment--infrastructure)
7. [Security Considerations](#7-security-considerations)
8. [Development & Testing](#8-development--testing)
9. [Future Considerations](#9-future-considerations)
10. [Glossary](#10-glossary)
11. [Project Identification](#11-project-identification)

---

## 1. Project Structure

```
rack-builder/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml          # GitHub Pages CI/CD pipeline
├── public/
│   ├── connectors/                   # Connector SVG icons
│   │   ├── blank.svg
│   │   ├── cee.svg
│   │   ├── d-series.svg
│   │   ├── powercon.svg
│   │   ├── rj45.svg
│   │   └── socapex.svg
│   ├── favicon.svg
│   ├── icons.svg                     # Shared SVG sprite
│   ├── pwa-192x192.png              # PWA icon (small)
│   ├── pwa-512x512.png              # PWA icon (large)
│   ├── rack_builder.png             # App branding
│   └── sector pro logo.png          # Logo asset
├── src/
│   ├── components/
│   │   ├── connectors/              # Connector CRUD UI
│   │   │   ├── ConnectorForm.tsx
│   │   │   └── ConnectorList.tsx
│   │   ├── devices/                 # Device management UI
│   │   │   ├── DeviceForm.tsx
│   │   │   ├── DeviceList.tsx
│   │   │   └── ImageCropper.tsx
│   │   ├── editor/                  # Rack layout editor
│   │   │   ├── DeviceNotes.tsx
│   │   │   ├── DevicePalette.tsx
│   │   │   ├── DraggableDevice.tsx
│   │   │   ├── LayoutModals.tsx       # Create/rename/delete layout modals
│   │   │   ├── MobileEditorSheet.tsx  # Mobile side drawer (devices + rack settings)
│   │   │   ├── MobileItemEditorPanel.tsx # Floating mobile item editor
│   │   │   ├── MobileRackGrid.tsx     # Mobile rack slot rendering
│   │   │   ├── PlacedDevice.tsx
│   │   │   ├── RackGrid.tsx
│   │   │   ├── RackSideDepthView.tsx
│   │   │   ├── RackSlot.tsx
│   │   │   ├── rackBlueprint.css
│   │   │   └── rackGeometry.ts
│   │   ├── layout/                  # App shell & navigation
│   │   │   ├── AppShell.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── layouts/                 # Layout CRUD UI
│   │   │   ├── LayoutForm.tsx
│   │   │   └── LayoutList.tsx
│   │   ├── panels/                  # Panel layout designer
│   │   │   ├── DraggableConnectorButton.tsx # Draggable connector (react-dnd)
│   │   │   ├── PanelLayoutCanvas.tsx
│   │   │   ├── PanelMobileSheet.tsx   # Mobile bottom sheet (connectors/properties/port-edit)
│   │   │   ├── PanelPropertiesSidebar.tsx # Desktop properties sidebar
│   │   │   └── panelDndTypes.ts
│   │   ├── print/                   # Print & PDF export views
│   │   │   ├── LayoutPrintSheet.tsx
│   │   │   ├── PanelPrintSheet.tsx
│   │   │   ├── PrintCartouche.tsx
│   │   │   ├── ProjectPrintCover.tsx
│   │   │   ├── ProjectPrintIndex.tsx
│   │   │   ├── RackBomSheet.tsx
│   │   │   ├── RackPrintView.tsx
│   │   │   └── layoutPrint.css
│   │   ├── racks/                   # Rack CRUD UI
│   │   │   ├── RackForm.tsx
│   │   │   └── RackList.tsx
│   │   ├── shared/                  # Shared utilities
│   │   │   └── AutoScaleText.tsx
│   │   └── ui/                      # Base UI primitives
│   │       ├── Button.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── DarkForm.tsx           # Dark-themed form primitives
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Select.tsx
│   │       └── ThemeToggle.tsx
│   ├── contexts/
│   │   └── HapticContext.tsx         # Haptic feedback provider
│   ├── data/
│   │   └── connectors.json          # Static connector definitions
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAutoScaleFont.ts
│   │   ├── useConnectors.ts
│   │   ├── useDeviceFiltering.ts    # Device palette search/filter state
│   │   ├── useDevices.ts
│   │   ├── useImageUpload.ts
│   │   ├── useLayoutCrud.ts         # Layout create/rename/delete modal state
│   │   ├── useLayoutItems.ts
│   │   ├── useLayouts.ts
│   │   ├── useMobileItemEditor.ts   # Mobile item editing state & handlers
│   │   ├── useMobilePlacement.ts    # Mobile drag/drop & slot-click placement
│   │   ├── usePanelDraft.ts         # Panel localStorage draft persistence
│   │   ├── usePanelGridPlacement.ts # Panel connector grid placement logic
│   │   ├── usePanelLayoutCounts.ts
│   │   ├── usePanelLayoutPorts.ts
│   │   ├── usePanelLayoutRows.ts
│   │   ├── usePanelLayouts.ts
│   │   ├── usePanelSave.ts          # Panel save with validation
│   │   ├── usePlacement.ts          # Rack placement issue detection
│   │   ├── useProject.ts            # Single project fetch by ID
│   │   ├── useProjects.ts
│   │   ├── useRackViewState.ts      # View mode, zoom, display toggles
│   │   ├── useRacks.ts
│   │   ├── useResponsiveLayout.ts   # Shared responsive media queries
│   │   └── useTheme.ts
│   ├── lib/                         # Pure logic & utilities
│   │   ├── connectorCatalog.ts
│   │   ├── layoutItemMapper.ts
│   │   ├── overlap.ts
│   │   ├── panelGrid.ts
│   │   ├── panelLayoutMapper.ts
│   │   ├── panelThumbnail.ts
│   │   ├── printPdfExport.ts
│   │   ├── rackHelpers.ts           # Placement image URL, error helpers
│   │   ├── rackPositions.ts
│   │   ├── rackViewModel.ts
│   │   ├── rackVisual.ts
│   │   └── supabase.ts
│   ├── pages/                       # Route-level page components
│   │   ├── ConnectorManagerPage.tsx
│   │   ├── DeviceManagerPage.tsx
│   │   ├── LayoutEditorPage.tsx
│   │   ├── LayoutManagerPage.tsx
│   │   ├── LayoutPrintPage.tsx
│   │   ├── LegacyLayoutEditorRedirectPage.tsx
│   │   ├── LegacyLayoutPrintRedirectPage.tsx
│   │   ├── PanelLayoutEditorPage.tsx
│   │   ├── PanelLayoutManagerPage.tsx
│   │   ├── PanelLayoutPrintPage.tsx
│   │   ├── PanelLayoutsOverviewPage.tsx
│   │   ├── ProjectManagerPage.tsx
│   │   ├── ProjectPrintPage.tsx
│   │   └── RackManagerPage.tsx
│   ├── types/
│   │   └── index.ts                 # Domain model interfaces
│   ├── database.types.ts            # Auto-generated Supabase types
│   ├── App.tsx                      # Root router & providers
│   ├── main.tsx                     # React DOM entry point
│   └── index.css                    # Global Tailwind styles
├── supabase/
│   ├── migrations/                  # 16 incremental SQL migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_layout_items_preferred_lane.sql
│   │   ├── ...
│   │   └── 015_layout_item_rack_ear_offset.sql
│   └── tests/                       # Database-level tests
├── tests/                           # Unit tests (Vitest)
│   ├── overlap.test.ts
│   ├── printPdfExport.test.ts
│   ├── rackPositions.test.ts
│   └── rackViewModel.test.ts
├── eslint.config.js                 # ESLint 9 flat config
├── postcss.config.js                # PostCSS + Tailwind v4
├── vite.config.ts                   # Vite 8 + PWA plugin
├── tsconfig.json                    # TypeScript composite config
├── tsconfig.app.json                # App source TS config
├── tsconfig.node.json               # Node tooling TS config
├── package.json
├── package-lock.json
└── .npmrc                           # legacy-peer-deps=true
```

---

## 2. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          USERS                                  │
│              (Desktop Browser / Mobile PWA)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB PAGES (CDN)                           │
│              Static SPA Hosting + PWA Shell                     │
│           ┌─────────────────────────────────┐                   │
│           │   React 19 SPA (Vite Build)     │                   │
│           │   • React Router v7             │                   │
│           │   • Tailwind CSS v4             │                   │
│           │   • Service Worker (Workbox)    │                   │
│           └──────────────┬──────────────────┘                   │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTPS (REST + Realtime)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (BaaS)                             │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │  PostgreSQL   │  │  Storage (S3)  │  │  PostgREST API     │  │
│  │  Database     │  │  Device Images │  │  Auto-generated    │  │
│  │  10 tables    │  │  JPEG uploads  │  │  REST endpoints    │  │
│  └──────────────┘  └────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**

```
User Interaction
      │
      ▼
React Component (Page)
      │
      ▼
Custom Hook (useDevices, useLayouts, etc.)
      │
      ▼
Supabase JS Client (@supabase/supabase-js)
      │
      ▼
Supabase PostgREST API ──► PostgreSQL Database
                           Supabase Storage ──► S3-compatible Blob Store
```

---

## 3. Core Components

### 3.1 Frontend Application

| Attribute     | Detail                                          |
|---------------|------------------------------------------------|
| **Framework** | React 19 with functional components & hooks     |
| **Language**  | TypeScript 5.9 (strict mode)                    |
| **Bundler**   | Vite 8 with HMR                                 |
| **Styling**   | Tailwind CSS v4 (PostCSS plugin)                 |
| **Routing**   | React Router v7 (BrowserRouter, client-side SPA) |
| **Icons**     | Lucide React                                     |
| **DnD**       | react-dnd v16 (HTML5 + Touch backends)           |
| **PWA**       | vite-plugin-pwa + Workbox service worker         |

### 3.2 Application Shell (`AppShell`)

The responsive navigation shell adapts to viewport size:

- **Desktop**: Sticky left sidebar with navigation links + scrollable main content area
- **Mobile**: Compact top header + fixed bottom navigation bar
- Supports safe area insets for modern mobile devices (notch, dynamic island)

### 3.3 Rack Layout Editor (`LayoutEditorPage`)

The core feature of the application. Provides a visual drag-and-drop rack builder:

- **DevicePalette**: Searchable/filterable device catalog; drag source
- **RackGrid**: Visual rack representation with U-slot grid; drop target
- **DraggableDevice** / **PlacedDevice**: DnD source and placed items
- **RackSideDepthView**: Side-profile depth visualization
- **RackSlot**: Individual U-slot rendering with collision detection
- Supports single-width and dual-width (side-by-side) racks
- Half-rack devices with lane/sub-lane positioning
- Front and rear views with mirrored positioning
- Device notes and custom naming

### 3.4 Panel Layout Designer (`PanelLayoutEditorPage`)

Visual connector panel designer for custom patch panels:

- **PanelLayoutCanvas**: Grid-based connector placement canvas
- Configurable row heights (4, 6, 8, 12, 16 holes per row)
- Connector spanning across multiple grid cells
- Active column masking for partial-width panels
- SVG thumbnail generation for panel previews

### 3.5 Print & PDF Export System

Professional-grade print output:

- **LayoutPrintSheet**: Single layout on A3 paper
- **ProjectPrintPage**: Multi-layout project documentation
- **ProjectPrintCover**: Cover page with project metadata
- **ProjectPrintIndex**: Table of contents
- **RackBomSheet**: Bill of Materials with weight/power summaries
- **PanelPrintSheet**: Panel layout documentation
- **PrintCartouche**: Technical drawing title block
- Adaptive DPI scaling (1.4x–3.5x) for mobile/desktop
- Client-side PDF generation via `html2canvas` + `jsPDF`
- A3 landscape and portrait support

### 3.6 Data Hooks Layer

Custom React hooks abstract all Supabase interactions:

**Data hooks** (Supabase interactions):

| Hook                    | Purpose                                    |
|------------------------|--------------------------------------------|
| `useProjects`          | Project CRUD + layout count aggregation     |
| `useProject`           | Single project fetch by ID                  |
| `useDevices`           | Device CRUD + category join + search/filter |
| `useRacks`             | Rack definition CRUD                        |
| `useLayouts`           | Layout CRUD scoped to project               |
| `useLayoutItems`       | Device placement CRUD with nested joins     |
| `usePanelLayouts`      | Panel layout CRUD with rows/ports           |
| `usePanelLayoutRows`   | Panel row management                        |
| `usePanelLayoutPorts`  | Connector port placement                    |
| `useConnectors`        | Connector catalog CRUD                      |
| `useImageUpload`       | Device image upload to Supabase Storage     |
| `usePanelLayoutCounts` | Panel usage count aggregation               |
| `useTheme`             | Dark/light mode toggle (localStorage)       |
| `useAutoScaleFont`     | Dynamic font sizing for labels              |

Each data hook returns `{ data, loading, error, create*, update*, delete*, refetch }`.

**UI state hooks** (extracted from page components):

| Hook                    | Purpose                                              |
|------------------------|------------------------------------------------------|
| `useResponsiveLayout`  | Shared media queries (isMobile, isTouchLikeDevice, isPortrait) |
| `useRackViewState`     | View mode, zoom, display toggles for rack editor     |
| `useDeviceFiltering`   | Device palette search, category, and brand filtering  |
| `useLayoutCrud`        | Layout create/rename/delete modal state & handlers    |
| `useMobileItemEditor`  | Mobile item editing state (name, notes, offset)       |
| `useMobilePlacement`   | Mobile drag/drop and slot-click placement handlers    |
| `usePlacement`         | Rack placement issue detection & view model           |
| `usePanelDraft`        | Panel localStorage draft hydration & auto-save        |
| `usePanelGridPlacement`| Panel connector grid placement logic                  |
| `usePanelSave`         | Panel save with mounting compatibility validation     |

### 3.7 Pure Logic Library (`src/lib/`)

Side-effect-free utility modules:

| Module                 | Purpose                                              |
|-----------------------|------------------------------------------------------|
| `rackPositions.ts`    | Slot CSS positioning for single/dual racks            |
| `rackViewModel.ts`    | Front/rear view model computation with ghost items    |
| `rackVisual.ts`       | Visual CSS helpers for device rendering               |
| `rackHelpers.ts`      | Placement image URL resolution, error formatting      |
| `overlap.ts`          | 3D depth conflict detection between devices           |
| `panelGrid.ts`        | Panel cell geometry calculations                      |
| `panelLayoutMapper.ts`| Row/port structure transformation                     |
| `panelThumbnail.ts`   | SVG thumbnail generation for panel previews           |
| `layoutItemMapper.ts` | Database row → `LayoutItemWithDevice` mapping         |
| `connectorCatalog.ts` | Connector grouping and catalog utilities              |
| `printPdfExport.ts`   | PDF assembly with adaptive scaling and page layout    |
| `supabase.ts`         | Supabase client singleton initialization              |

---

## 4. Data Stores

### 4.1 PostgreSQL (via Supabase)

**Type**: Managed PostgreSQL
**Purpose**: Primary relational data store for all application entities
**Access**: Supabase PostgREST auto-generated API

#### Entity-Relationship Overview

```
projects ─────┬──── layouts ──── layout_items ──┬── devices
              │                                  │
              ├──── panel_layouts ─┬── panel_layout_rows
              │                   └── panel_layout_ports ── connectors
              │
              └──── (owner metadata)

devices ──── device_categories
racks ──── layouts (via rack_id FK)
```

#### Key Schemas

**`projects`** — Top-level organizational container

| Column       | Type      | Notes             |
|-------------|-----------|-------------------|
| `id`        | UUID (PK) | Auto-generated    |
| `name`      | text      | Required          |
| `owner`     | text      | Optional metadata |
| `created_at`| timestamp | Auto-set          |
| `updated_at`| timestamp | Auto-set          |

**`devices`** — Equipment models/SKUs

| Column             | Type      | Notes                        |
|-------------------|-----------|------------------------------|
| `id`              | UUID (PK) |                              |
| `brand`           | text      |                              |
| `model`           | text      |                              |
| `rack_units`      | integer   | Height in U                  |
| `depth_mm`        | integer   | Physical depth               |
| `weight_kg`       | numeric   | For BOM calculations         |
| `power_w`         | numeric   | Power draw for BOM           |
| `is_half_rack`    | boolean   | Half-width device flag       |
| `fav`             | boolean   | Favorites flag               |
| `category_id`     | UUID (FK) | → device_categories          |
| `front_image_path`| text      | Supabase Storage path        |
| `rear_image_path` | text      | Supabase Storage path        |

**`layouts`** — Rack configurations within a project

| Column       | Type      | Notes                |
|-------------|-----------|----------------------|
| `id`        | UUID (PK) |                      |
| `project_id`| UUID (FK) | → projects           |
| `rack_id`   | UUID (FK) | → racks              |
| `name`      | text      |                      |

**`layout_items`** — Device placements in a layout

| Column              | Type          | Notes                               |
|--------------------|---------------|-------------------------------------|
| `id`               | UUID (PK)     |                                     |
| `layout_id`        | UUID (FK)     | → layouts                           |
| `device_id`        | UUID (FK)     | → devices (nullable)                |
| `panel_layout_id`  | UUID (FK)     | → panel_layouts (nullable)          |
| `start_u`          | integer       | Starting rack unit (0-indexed)      |
| `facing`           | enum          | 'front' or 'rear'                   |
| `preferred_lane`   | integer       | 0, 1, or null (half-rack position)  |
| `preferred_sub_lane`| integer      | 0, 1, or null                       |
| `force_full_width` | boolean       |                                     |
| `rack_ear_offset_mm`| numeric      | Ear offset for depth calc           |
| `custom_name`      | text          | User override label                 |
| `notes`            | text          | Freeform notes                      |

> **Constraint**: Exactly one of `device_id` or `panel_layout_id` must be non-null.

**`panel_layouts`** — Custom connector panel designs

| Column          | Type      | Notes                    |
|----------------|-----------|--------------------------|
| `id`           | UUID (PK) |                          |
| `project_id`   | UUID (FK) | → projects               |
| `name`         | text      |                          |
| `height_ru`    | integer   | 1–6 rack units           |
| `depth_mm`     | integer   |                          |
| `facing`       | enum      | 'front' or 'rear'        |
| `has_lacing_bar`| boolean  |                          |
| `weight_kg`    | numeric   |                          |
| `notes`        | text      |                          |

**`panel_layout_rows`** — Grid rows within a panel

| Column              | Type       | Notes                            |
|--------------------|------------|----------------------------------|
| `id`               | UUID (PK)  |                                  |
| `panel_layout_id`  | UUID (FK)  | → panel_layouts                  |
| `row_index`        | integer    | Row position                     |
| `hole_count`       | integer    | 4, 6, 8, 12, or 16              |
| `active_column_map`| JSONB      | Array of active column indices   |

**`connectors`** — Connector type catalog

| Column       | Type      | Notes                                        |
|-------------|-----------|----------------------------------------------|
| `id`        | text (PK) | Identifier string                            |
| `name`      | text      |                                              |
| `category`  | enum      | 'audio', 'data', 'power', 'multipin', 'other'|
| `image_path`| text      | SVG icon path                                |
| `is_d_size` | boolean   | Standard D-series cutout                     |
| `grid_width`| integer   | Width in hole units                          |
| `grid_height`| integer  | Height in hole units                         |
| `mounting`  | enum      | 'front', 'rear', or 'both'                   |
| `weight_kg` | numeric   |                                              |

#### Custom Enums

| Enum                | Values                                          |
|--------------------|------------------------------------------------|
| `rack_width`       | `'single'`, `'dual'`                            |
| `device_facing`    | `'front'`, `'rear'`                             |
| `connector_category`| `'audio'`, `'data'`, `'power'`, `'multipin'`, `'other'` |
| `connector_mounting`| `'front'`, `'rear'`, `'both'`                   |

#### Migrations

16 incremental SQL migrations tracked in `supabase/migrations/`:

| Migration | Purpose                                    |
|----------|--------------------------------------------|
| 001      | Initial schema (racks, devices, layouts)   |
| 002      | Layout items preferred lane support         |
| 003      | Projects and device categories              |
| 004      | Device weight and power fields              |
| 005      | Half-rack device support                    |
| 006      | Project owner field                         |
| 007      | Panel layouts tables                        |
| 008      | Panel layout constraints                    |
| 009      | Atomic panel RPC functions                  |
| 010      | Connectors catalog table + seed data        |
| 011      | Connector D-size profile support            |
| 012      | Storage image buckets                       |
| 013      | Layout items constraint alignment           |
| 014      | Layout item semantics/authority             |
| 015a     | Device favorites flag                       |
| 015b     | Layout item rack ear offset                 |

### 4.2 Supabase Storage (S3-Compatible)

**Type**: Object storage (S3-compatible)
**Purpose**: Device front/rear images
**Bucket**: `device-images` (public read, authenticated write)
**Path format**: `{front|rear}/{uuid}.jpg`
**Upload**: Client-side JPEG compression via canvas → blob

### 4.3 Local Storage (Browser)

**Purpose**: Theme preference persistence
**Key**: Dark/light mode toggle state
**Mechanism**: `useTheme()` hook with `localStorage`

### 4.4 Service Worker Cache (Workbox)

**Purpose**: Offline support and API response caching
**Strategy**: Stale-while-revalidate for Supabase API calls
**Max age**: 24 hours
**Scope**: Supabase REST endpoints matching project URL

---

## 5. External Integrations

| Service               | Purpose                          | Integration Method                |
|----------------------|----------------------------------|-----------------------------------|
| **Supabase**         | Database, storage, API           | `@supabase/supabase-js` client SDK |
| **GitHub Pages**     | Static SPA hosting               | GitHub Actions deployment          |
| **GitHub Actions**   | CI/CD pipeline                   | `.github/workflows/deploy-pages.yml` |
| **html2canvas**      | HTML → canvas rendering          | NPM library (client-side)         |
| **jsPDF**            | PDF document generation          | NPM library (client-side)         |
| **web-haptics**      | Mobile haptic feedback           | NPM library (Web Haptics API)     |

> **Note**: All PDF generation and image processing happens client-side. There are no server-side rendering services.

---

## 6. Deployment & Infrastructure

### 6.1 Hosting

| Layer        | Provider       | Service           |
|-------------|----------------|-------------------|
| Frontend    | GitHub Pages   | Static SPA CDN    |
| Backend     | Supabase       | Managed BaaS      |
| Database    | Supabase       | Managed PostgreSQL |
| Storage     | Supabase       | S3-compatible      |

### 6.2 CI/CD Pipeline

**Platform**: GitHub Actions
**Workflow**: `.github/workflows/deploy-pages.yml`

```
Push to main ──► Checkout ──► Node 22 Setup ──► npm ci ──► Build ──► Upload Artifact ──► Deploy to GitHub Pages
                                                                                              │
Pull Request ──► Same build steps ──► Deploy PR Preview (non-fork PRs only)
```

**Key steps**:
1. `npm ci` — Deterministic dependency install
2. `npm run build` — TypeScript compilation + Vite production build
3. SPA fallback — Copies `index.html` → `404.html` for client-side routing
4. GitHub Pages artifact upload and deployment
5. PR preview deployments for non-fork pull requests

### 6.3 PWA Configuration

| Setting          | Value                                  |
|-----------------|----------------------------------------|
| Display mode    | `standalone`                           |
| Theme color     | `#1e293b`                              |
| Icons           | 192x192, 512x512, maskable variants   |
| Service Worker  | Workbox (auto-update)                  |
| Offline         | Cached shell + API responses           |
| Install         | Add to Home Screen supported           |

### 6.4 Build Configuration

| Tool        | Version | Config File          |
|------------|---------|----------------------|
| Vite       | 8.0     | `vite.config.ts`     |
| TypeScript | 5.9     | `tsconfig.json`      |
| Tailwind   | 4.2     | `postcss.config.js`  |
| ESLint     | 9.x     | `eslint.config.js`   |
| PostCSS    | 8.5     | `postcss.config.js`  |

---

## 7. Security Considerations

### 7.1 Authentication

| Aspect        | Current State                                  |
|--------------|------------------------------------------------|
| Auth method  | Supabase anonymous/public key (no user auth)   |
| User sessions| None — all users share the same data space      |
| API key type | Publishable anon key (safe to expose client-side)|

### 7.2 Authorization

| Aspect                | Current State                               |
|----------------------|---------------------------------------------|
| Row Level Security   | Not enforced (public access)                |
| Project ownership    | `owner` field is metadata-only, not enforced |
| Storage permissions  | Public read, anon write for device images    |

### 7.3 Data Protection

| Aspect             | Implementation                              |
|-------------------|---------------------------------------------|
| Transport          | HTTPS enforced (Supabase + GitHub Pages)    |
| Data at rest       | Supabase-managed encryption                  |
| Sensitive data     | No PII collected; no passwords stored        |
| Client secrets     | Anon key only (designed for public exposure) |
| Input validation   | Client-side TypeScript type checking         |
| Image uploads      | JPEG-only with client-side compression       |

### 7.4 Security Tools

- **TypeScript strict mode** — Catches type-level errors at compile time
- **ESLint** — Static analysis for code quality and common mistakes
- **Dependabot** (GitHub default) — Dependency vulnerability scanning
- **HTTPS everywhere** — Both Supabase and GitHub Pages enforce TLS

---

## 8. Development & Testing

### 8.1 Local Setup

```bash
# Prerequisites: Node.js 22+, npm

# 1. Clone the repository
git clone https://github.com/jvhtec/rack-builder.git
cd rack-builder

# 2. Install dependencies
npm install

# 3. (Optional) Override Supabase credentials
#    Create .env with:
#    VITE_SUPABASE_URL=https://your-project.supabase.co
#    VITE_SUPABASE_ANON_KEY=your-anon-key

# 4. Start development server
npm run dev

# 5. Open http://localhost:5173
```

### 8.2 Available Scripts

| Script          | Command           | Purpose                        |
|----------------|-------------------|--------------------------------|
| `npm run dev`  | `vite`            | Start dev server with HMR      |
| `npm run build`| `tsc -b && vite build` | Type-check + production build |
| `npm run lint` | `eslint .`        | Run ESLint checks              |
| `npm run test` | `vitest`          | Run unit tests                 |
| `npm run preview`| `vite preview`  | Preview production build       |

### 8.3 Testing Framework

**Framework**: Vitest 4.1
**Runner**: Uses Vite's transform pipeline for fast execution

**Test Files** (`tests/`):

| Test File                  | Covers                                   |
|---------------------------|------------------------------------------|
| `rackPositions.test.ts`   | Slot CSS positioning for single/dual racks|
| `rackViewModel.test.ts`   | View model generation, ghost items        |
| `overlap.test.ts`         | 3D depth collision detection              |
| `printPdfExport.test.ts`  | PDF export helper functions               |

**Testing Pattern**:
```typescript
import { describe, expect, it } from 'vitest'

describe('rackPositions', () => {
  it('mirrors dual-rack quarter slots in rear view', () => {
    const front = getSlotStyle({ outer: 0, inner: 0 }, 'dual', 'front')
    expect(front).toEqual({ left: '0%', width: '25%' })
  })
})
```

### 8.4 Code Quality Tools

| Tool            | Purpose                     | Config                |
|----------------|-----------------------------|-----------------------|
| TypeScript 5.9 | Static type checking        | `tsconfig.app.json`   |
| ESLint 9       | Code linting                | `eslint.config.js`    |
| typescript-eslint| TS-specific lint rules     | `eslint.config.js`    |
| React Hooks lint| Hook dependency validation  | `eslint.config.js`    |
| Strict mode    | No unused locals/params     | `tsconfig.app.json`   |

---

## 9. Future Considerations

### 9.1 Known Technical Debt

- **No user authentication**: All data is shared globally via the anon key. Adding Supabase Auth with Row Level Security (RLS) policies is needed for multi-tenant use.
- **Embedded credentials**: Supabase URL and anon key are hardcoded in `src/lib/supabase.ts` with environment variable override. Should be environment-only.
- **No state management library**: Data flows through props drilling and context. As the app grows, a solution like Zustand or Jotai may be needed.
- **Limited test coverage**: Only core geometry/logic utilities are tested. No component tests, integration tests, or E2E tests.
- **Duplicate migration prefix**: Two migrations share the `015_` prefix (`device_favorites` and `layout_item_rack_ear_offset`).
- **Page component decomposition** (partially addressed): State logic has been extracted from `LayoutEditorPage.tsx` (~1,710 → ~620 lines) and `PanelLayoutEditorPage.tsx` (~1,250 → ~580 lines) into 10 custom hooks and 8 sub-components. Further decomposition of mobile/desktop view branches is possible.

### 9.2 Planned Migrations

- **Supabase Auth integration** — Enable user accounts and RLS for data isolation
- **Supabase Realtime** — Live collaboration on rack layouts (infrastructure exists but is unused)

### 9.3 Potential Enhancements

- **Component testing** — Vitest + React Testing Library for UI components
- **E2E testing** — Playwright or Cypress for critical user flows
- **Offline-first** — Enhanced PWA with local-first data sync
- **Export formats** — DWG/DXF export for CAD integration
- **Cable management** — Signal flow and cable routing between devices
- **Collaborative editing** — Real-time multi-user layout editing via Supabase Realtime

---

## 10. Glossary

| Term               | Definition                                                                 |
|-------------------|---------------------------------------------------------------------------|
| **U / Rack Unit** | Standard unit of height in a 19-inch rack (1U = 44.45 mm / 1.75 inches)  |
| **RU**            | Rack Unit — same as U                                                      |
| **BOM**           | Bill of Materials — summary of all devices with weight and power totals    |
| **Facing**        | Whether a device is mounted facing the front or rear of the rack           |
| **Lane**          | Horizontal position in a dual-width rack (lane 0 = left, lane 1 = right)  |
| **Sub-Lane**      | Position within a lane for half-rack devices (0 = left half, 1 = right)   |
| **Half-Rack**     | A device that occupies half the width of a standard 19-inch rack           |
| **Dual Rack**     | A rack configuration with two side-by-side 19-inch bays                    |
| **Panel Layout**  | A custom connector patch panel design with rows of connectors              |
| **Connector**     | A specific connector type (XLR, etherCON, powerCON, Socapex, etc.)        |
| **D-Size**        | Standard D-series panel cutout for pro audio connectors (XLR, etherCON)   |
| **Hole**          | A single grid position on a connector panel row                            |
| **Cartouche**     | Technical drawing title block containing project and layout metadata       |
| **Ghost Item**    | A semi-transparent device shown on the opposite face of a rack             |
| **PWA**           | Progressive Web App — installable web application with offline support     |
| **BaaS**          | Backend as a Service — cloud platform providing database, auth, storage    |
| **SPA**           | Single Page Application — client-side routed web application               |
| **DnD**           | Drag and Drop — interactive UI pattern for moving elements                 |
| **HMR**           | Hot Module Replacement — instant code updates during development           |
| **RLS**           | Row Level Security — PostgreSQL feature for per-user data access control   |
| **Lacing Bar**    | Horizontal cable management bar mounted behind a panel                     |

---

## 11. Project Identification

| Field                | Value                                              |
|---------------------|----------------------------------------------------|
| **Project Name**    | Rack Builder                                       |
| **Repository**      | https://github.com/jvhtec/rack-builder             |
| **Primary Language**| TypeScript (React)                                 |
| **License**         | —                                                  |
| **Primary Contact** | jvhtec (GitHub)                                    |
| **Last Updated**    | 2026-03-19                                         |

---

*This document was last updated on 2026-03-19.*
