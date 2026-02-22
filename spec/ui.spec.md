# UI Design Specification

> Date: 2026-02-21
> Stack: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
> Design Language: Notion-style — clean, minimal, high information density
> All UI text in English

---

## Global Layout

The application uses an admin dashboard layout consisting of a fixed left sidebar and a scrollable main content area that fills the remaining viewport width.

### Sidebar

The sidebar is a vertical navigation panel fixed to the left edge of the viewport. In its expanded state it is 240px wide (`w-60`). On medium screens it collapses to an icon-only mode at 56px wide (`w-14`). On small screens it is hidden entirely and accessible via a hamburger menu button in the top-left corner of the content area.

The sidebar contains, from top to bottom:

1. **App Identity**: The application name "Energy Monitor" displayed next to a Zap icon from lucide-react. In collapsed mode, only the icon is shown.
2. **Navigation Links**: Three items — "Map Overview", "Upload Data", "Chatbot". Each link shows an icon and a text label. The active page is indicated by bold text and a 2px accent border on the left edge. Inactive items use `text-muted-foreground`.
3. **Theme Toggle**: A light/dark mode toggle button at the bottom of the sidebar.

The sidebar background uses `bg-background` with a `border-r` divider separating it from the content area. All text is `text-sm`.

### Page Header

Each page renders a header bar at the top of the content area. This bar is 56px tall (`h-14`) and contains the page title on the left side, rendered in `text-lg font-semibold`. Some pages include additional controls on the right side of the header (e.g., the utility dropdown on the Map Overview page). There are no breadcrumbs because the navigation is flat.

---

## Page 1: Map Overview (Route: `/`)

This is the landing page. It displays an interactive map of the OSU campus with building markers indicating energy anomaly status.

### Page Header Controls

The header displays "Map Overview" as the title. On the right side, two dropdowns are placed side by side:

1. **Utility Selector**: Labeled "Utility", allows the user to select which utility type's anomaly scores are shown on the map (default: Electricity).
2. **Scoring Method Selector**: Labeled "Scoring", allows the user to switch the anomaly score normalization method. Three options are available:
   - "Percentile Rank" — Z-score based percentile ranking across all buildings (relative)
   - "Absolute Threshold" — Fixed residual thresholds per utility type (absolute)
   - "Size-Normalized" (default) — Mean absolute residual per sqft, min-max normalized across buildings

When the scoring method is changed, all building markers update their scores and colors. The selected method also applies to the Building Detail page's anomaly scores.

### Utility Selector

This is a shadcn Select dropdown. It presents 8 options corresponding to the utility types: Electricity (kWh), Gas, Heat, Steam (kg), Cooling (ton-hours), Cooling Power (tons), Steam Rate, Oil. The default selection is Electricity. When the user changes the selection, all building markers on the map update their anomaly scores and status colors to reflect the selected utility.

### Interactive Map

The map occupies the full width of the content area and a height of `calc(100vh - 14rem)`, ensuring it fills most of the viewport. It uses the mapcn `Map` component centered on the OSU main campus at coordinates `[-83.06, 40.08]` with zoom level 14. The map uses the default CARTO tile set (no API key required) and automatically switches between light and dark tile themes based on the application's current theme.

Zoom controls and a fullscreen button are rendered in the bottom-right corner of the map via the `MapControls` component.

### Building Markers

Each building with meter data is represented as a `MapMarker` positioned at its latitude/longitude. The marker's visual element (rendered via `MarkerContent`) is a filled circle with a white 2px border and a drop shadow. The circle's color and size vary by anomaly status:

- **Normal** (score < 0.3): emerald-500 green, 16px diameter
- **Caution** (0.3 to 0.5): yellow-400, 20px diameter
- **Warning** (0.5 to 0.8): orange-400, 24px diameter
- **Anomaly** (>= 0.8): red-500, 28px diameter

All markers have `cursor-pointer` and scale up to 125% on hover with a smooth CSS transition.

**Tooltip (hover)**: When the user hovers over a marker, a `MarkerTooltip` appears showing the building name on the first line and "Score: X.XX" on the second line, in `text-xs`.

**Popup (click)**: When the user clicks a marker, a `MarkerPopup` opens with a width of 256px (`w-64`). The popup contains the building name as a bold heading, the building number prefixed with "#", then a grid showing Anomaly Score, Gross Area (formatted with comma separators and "sqft" suffix), and Status (as a colored dot with label). At the bottom, a ghost-variant button labeled "View Details" with an ArrowRight icon navigates to the building detail page at `/buildings/:buildingNumber`.

### Map Legend

Below the map, a horizontal bar displays four status indicators in a row: a colored dot followed by the label for each status level (Normal in green, Caution in yellow, Warning in orange, Anomaly in red). The text is `text-xs text-muted-foreground` with `gap-6` between items.

---

## Page 2: Building Detail (Route: `/buildings/:buildingNumber`)

A detailed dashboard for a single building. The user arrives here by clicking "View Details" from a map marker popup.

### Back Navigation

At the top-left of the page, a ghost button with an ArrowLeft icon and the label "Back to Map" navigates back to `/`. Next to it (or on the same line), the building name is displayed in `text-lg font-semibold` followed by the building number in `text-muted-foreground`.

### Building Info Card

A shadcn Card titled "Building Information". The card body is a 2-column grid (`grid grid-cols-2 gap-y-2`). The left column contains labels in `text-sm text-muted-foreground` and the right column contains values in `text-sm font-medium`. The displayed fields are: Name, Building Number, Campus, Address, Gross Area (formatted with commas and "sqft"), Floors (e.g., "2 above / 1 below"), and Construction Year (extracted from the construction date).

### Anomaly Summary Card

A shadcn Card titled "Anomaly Overview" placed beside the Building Info Card on large screens (2-column grid at `lg` breakpoint, stacking vertically on smaller screens). The central element is the overall anomaly score displayed in `text-4xl font-bold`, colored according to the status thresholds. Below the score, a StatusBadge shows the status classification. Further down, two lines show the utility with the highest anomaly score and the utility with the lowest, formatted as "Highest: ELECTRICITY (0.89)" and "Lowest: GAS (0.12)".

### Utility Cards

A horizontally scrollable row of compact cards, one for each utility type that the building has meter data for. The container uses `flex gap-3 overflow-x-auto pb-2`. Each card is 176px wide (`w-44`) and does not shrink (`flex-shrink-0`).

Each card contains: a utility-specific icon from lucide-react (Zap for Electricity, Flame for Gas, Thermometer for Heat, CloudFog for Steam, Snowflake for Cooling, Gauge for Cooling Power, Wind for Steam Rate, Droplets for Oil) and the utility name in bold at the top. Below that, four rows display Latest Actual value, Latest Predicted value, Difference (actual - predicted, shown in red if positive indicating over-consumption, green if negative), and the Anomaly Score colored by status thresholds. At the bottom, a small StatusBadge shows the status.

### Time Series Chart

A recharts-based line chart showing actual vs. predicted energy consumption over time. The chart area is 320px tall (`h-80`) and spans the full content width.

Above the chart, a shadcn Tabs component provides tab triggers for each utility type the building has. Selecting a tab switches the chart data to that utility. Beside the tabs, a date range selector offers presets: "Last 7 days", "Last 30 days", "All".

The chart renders three data series:
1. **Actual**: solid blue line
2. **Predicted**: dashed gray line
3. **Residual**: area chart fill — red fill above zero (over-consuming), green fill below zero (under-consuming)

The X-axis shows date/time labels. The Y-axis shows values in the utility's units. A crosshair tooltip appears on hover, displaying the exact timestamp, actual value, predicted value, and residual for that point.

### Anomaly Detail Table

A shadcn Table below the time series chart. It lists the time periods with the highest anomaly indicators for the currently selected utility. Columns: Timestamp, Actual, Predicted, Residual, Z-Score, Status (as a colored StatusBadge).

The table is sortable by clicking column headers (default: sorted by absolute residual descending). Initially 20 rows are shown. A "Show more" button at the bottom loads additional rows in batches of 20.

---

## Page 3: Upload Data (Route: `/upload`)

An interface for adding new data to the system in the same format as existing datasets.

### Data Type Tabs

At the top of the page, a shadcn Tabs component provides three tabs: "Meter Data", "Weather Data", "Building Data". The selected tab determines which data schema is expected and which form/upload options are available.

### Upload Method Toggle

Below the tabs, a shadcn ToggleGroup (single-select) allows the user to choose the input method. For Meter Data and Building Data, the options are "CSV Upload" and "Manual Entry". For Weather Data, there is an additional option: "Fetch from API".

### CSV Upload Zone

Displayed when "CSV Upload" is selected. A large rectangular drop zone with a dashed border (`border-2 border-dashed rounded-lg`) and a centered Upload icon from lucide-react. Text reads "Drag & drop a CSV file here" with a secondary line "or click to browse" and a tertiary line "Accepted: .csv (max 250MB)".

When the user drags a file over the zone, the border color changes to `border-primary` and the background becomes `bg-primary/5`. After a file is selected, the zone updates to show the filename, file size, and detected row/column counts.

### Manual Entry Form

Displayed when "Manual Entry" is selected. A form with labeled input fields specific to the selected data type.

**Meter Data fields**: Meter ID (number), Site Name (text), SIMS Code (number), Utility (dropdown matching the 8 utility types), Reading Time (datetime picker), Reading Value (number), Reading Units (auto-filled based on the selected utility, read-only).

**Weather Data fields**: Date (datetime picker), Temperature in F (number), Relative Humidity in % (number), Precipitation in mm (number, optional), Wind Speed in mph (number, optional), Cloud Cover in % (number, optional), Apparent Temperature in F (number, optional).

**Building Data fields**: Building Number (text), Building Name (text), Campus Name (text), Address (text), Gross Area in sqft (number), Floors Above Ground (number), Floors Below Ground (number, optional), Construction Date (date picker, optional), Latitude (number, optional), Longitude (number, optional).

An "Add Row" button appends the current form data as a new row to the Data Preview table below and resets the form for the next entry. A "Submit All" button sends all accumulated rows to the API.

### Weather API Fetcher

Displayed when "Fetch from API" is selected under the Weather Data tab. Shows two date pickers for start and end dates, a read-only display of the fixed OSU campus coordinates (40.08, -83.06), and a "Fetch Data" button. On click, the backend proxies a request to the Open-Meteo Historical Forecast API. The fetched data populates the Data Preview table, where the user can review and then submit.

### Data Preview

A shadcn Table showing a preview of the data about to be submitted. The table displays the first 5 rows with horizontal scroll if needed. Above the table, a count label shows "Showing 5 of N rows".

Below the table, a validation summary displays three lines with status icons:
- CheckCircle (green) + "N valid rows"
- AlertTriangle (yellow) + "N rows with missing values" (if any)
- XCircle (red) + "N rows with invalid format" (if any)

Two action buttons at the bottom right: "Cancel" (secondary variant, clears all data) and "Submit N rows" (primary variant, disabled during validation and showing a spinner during submission). On successful submission, a toast notification confirms the result.

---

## Page 4: Chatbot (Route: `/chat`)

A ChatGPT-style conversational interface for querying and analyzing energy data. Built using Vercel AI SDK's `useChat` hook.

### Chat Container

The page uses a full-height flex column layout. The message area fills all available vertical space with `overflow-y-auto`. The input area is pinned to the bottom.

### Empty State

When no messages exist, a centered empty state is displayed. It shows a Sparkles icon from lucide-react, the heading "Energy Analysis Assistant", and a description: "Ask questions about building energy data, run analyses, or predict consumption patterns." Below, three clickable suggestion chips are displayed:

1. "Which buildings have the highest anomaly scores for electricity?"
2. "Compare energy usage of Building 311 vs Building 356"
3. "What if temperature was 10F higher on Sept 15?"

Clicking a chip pre-fills the input and submits the message.

### Message Display

Messages alternate between user and assistant bubbles. Both use a maximum width of 80% of the container.

**User messages** are right-aligned with `bg-primary text-primary-foreground`, rounded corners with a smaller bottom-right radius (`rounded-2xl rounded-br-sm`) to create a speech-bubble effect.

**Assistant messages** are left-aligned with `bg-muted`, rounded corners with a smaller bottom-left radius (`rounded-2xl rounded-bl-sm`). Text content is rendered as markdown using `react-markdown` with `remark-gfm` for tables and strikethrough support.

### Tool Invocation Blocks

When the assistant invokes a tool, a special block is rendered inline within the assistant message. Tool invocations appear as `tool-invocation` parts in the message's parts array.

**Python Execution Block**: Appears as a code editor-style card. The header bar has a dark background (`bg-zinc-800 rounded-t-lg`) showing "Python" on the left and a "Copy" button on the right. The code body uses a dark theme (`bg-zinc-950 text-zinc-50`) with monospace font (`font-mono text-sm`) and syntax highlighting. Below the code, an output section with a light background (`bg-muted rounded-lg`) displays the execution result. If the code produces images (matplotlib plots etc.), they are displayed as inline images. If there is an error, the output section uses a red-tinted background (`bg-red-50 dark:bg-red-950/20 text-red-600`).

During streaming, the code block shows a typing animation as characters appear. When the code is submitted for execution, a "Running..." spinner appears below the code. When output is received, the spinner is replaced by the output section.

**ML Prediction Block**: Appears as a card with a crystal ball icon and "ML Prediction" header. The card body shows the model name, building number, time period, anomaly score (colored by status), RMSE, and if available, an inline chart image showing predicted vs. actual values.

### Chat Input

The input area at the bottom of the chat consists of a textarea that auto-resizes between a minimum height of 40px and a maximum of 160px. The textarea has placeholder text "Ask about energy data...". To the right, a circular send button (32px, `bg-primary`, ArrowUp icon) submits the message. Pressing Enter submits; Shift+Enter creates a new line.

When `status` is `streaming`, the send button is replaced by a square stop button with a red accent that calls `stop()`. When `status` is not `ready`, the input and send button are disabled.

### Streaming Indicator

While the assistant is generating a response (`status === 'submitted'`), three animated dots and the text "Thinking..." are displayed below the last message. When a tool is executing, this changes to a spinner icon and "Running Python code..." or "Running prediction model...".

---

## Shared Components

### StatusBadge

A reusable component displaying a colored dot and an optional text label. Available in two sizes: `sm` (12px dot, `text-xs` label) and `md` (16px dot, `text-sm` label). The color and label are determined by the status prop: `normal` = emerald-500 + "Normal", `caution` = yellow-400 + "Caution", `warning` = orange-400 + "Warning", `anomaly` = red-500 + "Anomaly".

### ScoreDisplay

Displays a numeric anomaly score (0 to 1) with color coding. Available in two sizes: `sm` renders the score in `text-sm font-medium`, `lg` renders in `text-4xl font-bold`. The text color is determined by the score's status threshold.

### UtilityIcon

Maps a utility type string to its corresponding lucide-react icon: ELECTRICITY = Zap, GAS = Flame, HEAT = Thermometer, STEAM = CloudFog, COOLING = Snowflake, COOLING_POWER = Gauge, STEAMRATE = Wind, OIL28SEC = Droplets.

### Score Thresholds

A set of global constants used consistently across all components:

| Score Range | Status | Color |
|---|---|---|
| < 0.3 | normal | emerald-500 |
| 0.3 to < 0.5 | caution | yellow-400 |
| 0.5 to < 0.8 | warning | orange-400 |
| >= 0.8 | anomaly | red-500 |

---

## Routing

| Path | Page | Description |
|---|---|---|
| `/` | Map Overview | Landing page with campus map |
| `/buildings/:buildingNumber` | Building Detail | Single building dashboard |
| `/upload` | Upload Data | Data upload and entry |
| `/chat` | Chatbot | AI-powered data analysis chat |

Client-side routing is handled by React Router (`react-router-dom`). The Building Detail page is a dynamic route. All routes are wrapped in the AppLayout component (sidebar + content area).

---

## Theme

### Color System

The application uses the shadcn/ui default theme extended with semantic tokens:

- `--background`: white (light) / zinc-950 (dark) — page background
- `--foreground`: zinc-950 (light) / zinc-50 (dark) — primary text
- `--muted`: zinc-100 (light) / zinc-800 (dark) — assistant message background, secondary surfaces
- `--primary`: zinc-900 (light) / zinc-50 (dark) — user message background, buttons, active navigation
- `--muted-foreground`: zinc-500 (light) / zinc-400 (dark) — secondary text, labels, inactive navigation

### Typography

Following Notion's design language: Inter font (falling back to system sans-serif) for body text. JetBrains Mono (falling back to `font-mono`) for code blocks. The base text size is 14px (`text-sm`). Headings are normal weight, slightly larger, with no uppercase transforms.

### Spacing

Tailwind's standard spacing scale is used consistently. Page content padding is 24px (`p-6`). Cards use 16px padding (`p-4`). Gaps between major sections are 24px (`gap-6`). Dashboard elements use compact density where appropriate.

### Responsive Behavior

| Breakpoint | Sidebar | Layout |
|---|---|---|
| >= 1024px (`lg`) | Expanded with labels, 240px wide | Full dashboard grids |
| 768-1023px (`md`) | Collapsed to icons only, 56px wide | 2-column grids reduce to 2 |
| < 768px (`sm`) | Hidden, accessible via hamburger button | Single column, stacked layout |

The primary design target is desktop at 1280px and above. Mobile is secondary but all pages remain functional with stacked layouts and horizontal scroll where needed.

---

## Data Flow

The frontend communicates exclusively with the FastAPI backend via REST API calls. Data fetching happens on page mount and route transitions. The chat page uses SSE streaming via the Vercel AI SDK `useChat` hook with the `api` parameter pointed at the backend's `/api/chat` endpoint. No data is persisted client-side beyond React state and React Router's in-memory cache.
