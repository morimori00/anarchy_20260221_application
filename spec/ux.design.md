# UX Design Specification

> Date: 2026-02-21

This document defines user experience patterns, interaction flows, and behavioral specifications for the Energy Efficiency Monitoring Application.

---

## Target Users

**Primary**: Campus energy managers and facilities planning staff. They understand building operations but are not data scientists. They need clear, evidence-based signals for investment prioritization.

**Secondary**: Hackathon judges evaluating the prototype. They need to quickly understand the application's value proposition and navigate its features.

---

## Core User Flows

### Flow 1: Portfolio Screening (Map Overview)

The user opens the application and lands on the Map Overview page. The map loads with all 287 buildings displayed as colored markers, with anomaly scores based on the default utility type (Electricity). The user can immediately identify problem areas by scanning for red and orange markers clustered in campus regions.

The user changes the utility dropdown to "Steam" to see how buildings perform on a different energy type. The markers animate to update their colors and sizes. The user notices a cluster of red markers near the medical campus and hovers over them to read building names and scores in tooltips. They click a high-anomaly building to open its popup, review summary metrics, and click "View Details" to investigate further.

### Flow 2: Building Investigation (Building Detail)

Arriving at the Building Detail page, the user first reviews the Building Info Card for context (building age, size, campus). They check the Anomaly Summary Card to see the overall score and which utility is driving the anomaly. They scan the Utility Cards horizontally to compare all utilities at a glance.

The user clicks the "ELECTRICITY" tab above the time series chart to see the actual vs. predicted consumption over time. They notice a sustained gap between the blue actual line and the gray predicted line in mid-September. They switch the date range to "All" to confirm this pattern persists through October. They scroll down to the Anomaly Detail Table to see the specific time periods with the highest residuals, sorted by magnitude.

They click "Back to Map" to return and investigate another building.

### Flow 3: Data Upload

The user selects "Upload Data" from the sidebar. They want to add November meter data. They select the "Meter Data" tab and choose "CSV Upload". They drag a CSV file onto the drop zone. The system validates the file, showing a preview of the first 5 rows, a count of 48,000 valid rows and 12 rows with missing values. The user clicks "Submit 48,000 rows". A spinner appears, then a success toast confirms the data was ingested.

Next, the user switches to the "Weather Data" tab and selects "Fetch from API". They set the start date to November 1 and end date to November 30. They click "Fetch Data". The system shows a preview of 720 hourly weather observations. They click "Submit 720 rows" to import.

### Flow 4: AI-Assisted Analysis (Chatbot)

The user opens the Chatbot page and sees the empty state with suggestion chips. They click "Which buildings have the highest anomaly scores for electricity?" The message is sent and the assistant begins streaming a response. The assistant invokes the Python execution tool — a code block appears showing a pandas query that groups buildings by anomaly score and sorts them. The code runs, and the output block shows a ranked table of the top 10 buildings.

The user then types: "What would Building 311's energy consumption look like if the average temperature was 10 degrees higher?" The assistant invokes the ML prediction tool with weather overrides. A prediction card appears showing the hypothetical anomaly score alongside the original, demonstrating how temperature sensitivity affects the building's performance ranking.

---

## Navigation Design

Navigation is flat with three top-level pages accessible from the sidebar. The Building Detail page is not directly in the sidebar — it is reached by clicking through from the Map Overview. This keeps the navigation simple while providing deep-dive capability.

The sidebar active state (bold text + left accent border) provides clear orientation. The user always knows which section they are in.

The "Back to Map" button on the Building Detail page provides a clear escape hatch. It navigates to the Map Overview, preserving the previously selected utility type.

---

## Loading States

Every data-fetching operation displays a loading state to prevent user confusion.

### Map Overview
When the page first loads, the map container shows immediately (tiles load progressively). Building markers appear in a batch once the `/api/buildings` response arrives. During loading, a subtle spinner is shown in the page header area. If the utility is changed, existing markers remain visible while new scores are fetched; once the response arrives, markers animate to their new colors/sizes.

### Building Detail
On page load, the building info card and anomaly summary card show skeleton loaders (gray pulsing rectangles matching the layout of the final content). The time series chart shows a centered spinner within its container. Data arrives progressively — the info card populates first (from cached building list data), then anomaly data, then chart data.

### Upload
The CSV upload zone shows a progress bar during file reading (client-side). After submission, the "Submit" button shows a spinner and becomes disabled. The Data Preview table shows a skeleton during server-side validation.

### Chatbot
Streaming state uses a "Thinking..." indicator with animated dots. Tool execution shows contextual messages ("Running Python code..." or "Running prediction..."). The send button transforms into a stop button during streaming.

---

## Error Handling

### Network Errors
If any API call fails due to network issues, a toast notification appears at the top-right of the screen with a red accent, showing "Connection error. Please try again." Persistent failures (3+ retries) show a full-page error state with a "Retry" button.

### Data Validation Errors
On the Upload page, validation errors are displayed inline in the Data Preview section. Individual row errors are highlighted in the preview table. The submit button remains disabled until at least one valid row exists.

### 404 Errors
If a user navigates to `/buildings/999` and the building does not exist, a centered message "Building not found" with a "Back to Map" button is displayed instead of the building detail content.

### Chat Errors
If the LLM API returns an error, the error is displayed as a red-tinted message block in the chat. A "Retry" button below the error message calls `regenerate()` to re-attempt the last request.

### Empty States
If no buildings have data for the selected utility type, the map shows a message overlay: "No buildings with [utility] data available." The Building Detail page handles missing utilities gracefully — the utility card row simply shows fewer cards, and the tab list only includes available utilities.

---

## Interaction Micro-Patterns

### Marker Hover and Click
Hovering a map marker shows a tooltip (150ms delay to prevent flickering). Clicking opens a popup. If another popup is already open, the first closes before the new one opens (only one popup visible at a time).

### Utility Dropdown
Changing the utility dropdown on the Map Overview triggers a re-fetch of anomaly scores. While loading, the previous markers remain visible with reduced opacity (50%) to signal that an update is in progress. Once data arrives, markers transition to their new state.

### Table Sorting
Clicking a column header in the Anomaly Detail Table sorts by that column. The first click sorts descending, the second click sorts ascending, the third resets to the default sort. An arrow indicator in the header shows the current sort direction.

### Chat Auto-Scroll
As streaming tokens arrive, the message area auto-scrolls to keep the latest content visible. If the user manually scrolls up (indicating they want to read earlier messages), auto-scroll pauses. It resumes when the user scrolls back to the bottom.

### Form Validation
Manual entry forms validate on blur (when the user moves to the next field). Required fields show a red border and "Required" helper text if left empty. Number fields reject non-numeric input. The "Add Row" button is disabled if the form has validation errors.

---

## Responsive Adaptations

### Desktop (>= 1024px)
Full sidebar with text labels. Building Info and Anomaly Summary cards in a 2-column grid. Utility cards scroll horizontally if there are more than 4. Full-width charts and tables.

### Tablet (768-1023px)
Icon-only sidebar. Building Info and Anomaly Summary cards stack vertically. Map takes full width. Chat input area adjusts to full width.

### Mobile (< 768px)
Sidebar hidden behind hamburger button, opens as an overlay. All cards stack vertically. The Anomaly Detail Table scrolls horizontally. The chat interface remains mostly unchanged since it is already a single-column layout.

---

## Accessibility

- All interactive elements are keyboard-accessible with visible focus indicators.
- Color is never the sole means of conveying information — status indicators always include text labels alongside colored dots.
- Map markers have ARIA labels describing the building name and status.
- The chat interface supports screen reader announcements for new messages via ARIA live regions.
- Contrast ratios meet WCAG 2.1 AA standards. The dark theme maintains equivalent contrast.
- Form inputs have associated labels. Error messages are linked to their input via `aria-describedby`.

---

## Performance Targets

| Metric | Target |
|---|---|
| Initial map load (markers visible) | < 2 seconds |
| Utility switch (markers update) | < 1 second |
| Building detail page load | < 1.5 seconds |
| Chat first token | < 1 second |
| Chat streaming throughput | 30+ tokens/second perceived |
| CSV upload (50K rows) | < 5 seconds to preview |
