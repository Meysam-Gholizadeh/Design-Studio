# UX and Visual Design Specification
## BI Design Studio

**Version:** 1.0

---

## 1. Design direction

Create a polished, modern, professional SaaS application for BI dashboard design.

The product itself should demonstrate good dashboard design principles:
- Clear hierarchy
- Consistent spacing
- Restrained use of color
- Readable typography
- Useful whitespace
- Strong alignment
- Meaningful visual grouping
- Accessible contrast

Avoid a generic admin template appearance. The interface should feel like a purpose-built design tool.

## 2. Main application shell

### Desktop layout
- Left navigation rail/sidebar.
- Main content area.
- Consistent top header with page title and contextual actions.
- Use a restrained neutral base palette and one primary accent color.
- Keep navigation compact and clear.

### Navigation labels
- Home
- Dashboard Gallery
- Themes & Layouts
- Dashboard Editor
- My Designs
- AI Design Assistant (future / disabled or clearly marked as coming later)

## 3. Home page

Include:
- Welcome headline and short product explanation.
- Two prominent starting actions:
  - Explore professional templates
  - Create from blank
- Category shortcuts.
- Recently edited designs (if any).
- Featured templates.
- A small explanation of the workflow: choose → customize → export.

## 4. Dashboard Gallery

### Layout
- Page heading: “Explore Dashboard Designs”.
- Search input.
- Category filter chips or tabs.
- Optional filters: audience, complexity, number of pages, visual style.
- Responsive card grid.

### Template card
Each card should show:
- A real rendered mini dashboard preview or carefully composed preview image.
- Template name.
- Business category.
- Short description.
- Page count.
- 2–4 key KPIs or tags.
- Preview action.

Do not make all cards visually identical if their dashboard content differs. Keep card structure consistent while showing the template's actual composition.

### Category taxonomy
- Finance & Controlling
- Operations
- Human Resources
- Sales & Marketing
- Procurement
- Executive Management

Future categories may include Customer Service, IT & Technology, Logistics, Project Management, and Risk & Compliance.

## 5. Template detail / preview

Display:
- Large dashboard preview.
- Page navigation for multi-page templates.
- Template title and description.
- Intended audience and use case.
- Included KPIs.
- Included visual types.
- Theme and layout labels.
- Primary CTA: **Use this design**.
- Secondary CTA: **Back to gallery**.

The preview must be based on the same structured definition that opens in the editor, so the preview and editable result do not diverge.

## 6. Dashboard editor

### Desktop editor layout
Three primary columns:
1. **Left panel — Visual Library / Pages / Layers**
2. **Center — Canvas**
3. **Right panel — Properties / Theme / Page settings**

Suggested proportions:
- Left: 220–260 px
- Center: flexible
- Right: 280–320 px

Allow side panels to collapse to give the canvas more space.

### Editor header
- Design name (editable)
- Save status
- Undo / redo
- Add page
- Preview mode
- Export
- Back to gallery / Home

### Left panel
Tabs:
- Visuals
- Pages
- Layers (can be basic in MVP)

Visuals tab groups:
- Charts: Bar, Line, Area, Pie, Donut, Stacked Bar, Combo
- Metrics: KPI, Gauge
- Data: Table, Slicer
- Content: Text, Image, Divider

Each item should have an icon, label, and short tooltip. Items should be draggable and also clickable to add (accessibility and usability fallback).

### Canvas
- Clear page boundary and configurable page dimensions.
- Light neutral editor workspace around the page.
- Grid alignment guides or snap behavior.
- Selected component has a visible outline and resize handles.
- Drag-over state shows where the item will land.
- Empty canvas shows an instructional message.
- Support zoom-to-fit if feasible.
- Visuals should render as realistic previews, not generic placeholder rectangles.

### Properties inspector
Show controls relevant to the selected visual:
- General: title, subtitle, visibility, lock.
- Layout: width, height, position, alignment.
- Style: background, border, radius, padding, typography.
- Data / visual: labels, legend, orientation, series, KPI formatting, table columns.
Use sensible controls (text inputs, selects, toggles, color pickers, numeric inputs). Group related settings into collapsible sections if the panel becomes long.

When no visual is selected, show:
- Page settings
- Theme settings
- Layout settings
- Helpful hint to select a visual.

## 7. Themes

Create four polished themes. Suggested tokens:

### Corporate Blue
- Light neutral page background
- White cards
- Navy / blue primary
- Muted gray labels
- Subtle borders
- Professional chart palette

### Minimal Light
- White / near-white background
- Low-contrast borders
- Generous whitespace
- Dark neutral typography
- Restrained accent colors

### Modern Dark
- Deep charcoal/navy background
- Slightly lighter card surfaces
- High-contrast text
- Carefully selected bright chart colors
- Avoid pure black backgrounds

### Vibrant
- Light neutral or subtle tinted background
- Strong but balanced accent palette
- Color used to distinguish categories and key metrics
- Avoid excessive rainbow coloring

Theme selection should show live swatches and a sample preview. Themes must be applied through tokens, not template-specific CSS.

## 8. Layout presets

Provide preview thumbnails and short explanations for:
- Executive Overview
- Sidebar Navigation
- Data Dense
- Storytelling

Clearly explain that a layout preset changes composition, while a theme changes visual styling.

## 9. Interaction design

- Dragging from Visual Library adds a new component.
- Clicking a library item adds it to a sensible next available position.
- Selected component displays resize handles and inspector.
- Escape deselects or cancels drag where appropriate.
- Delete/Backspace removes a selected component only when focus is not inside a text input.
- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z for undo/redo if supported.
- Duplicate action should create a nearby non-overlapping copy.
- Confirmation before deleting a page or resetting a populated canvas.
- Provide toast or inline feedback for save, import, export, and errors.

## 10. Responsive behavior

- Gallery and home pages should adapt to tablet and mobile widths.
- Editor is desktop-first.
- On narrow screens, show a message or guided simplified mode rather than compressing all three editor panels into unusable columns.
- Preview modes: Desktop, Tablet, Mobile.
- Responsive preview must not overwrite the user's saved desktop layout.

## 11. Accessibility

- Keyboard-operable navigation and controls.
- Click-to-add alternative to drag-and-drop.
- Accessible labels for icon-only buttons.
- Visible keyboard focus.
- Adequate text and chart contrast.
- Do not rely on color alone to communicate status.
- Tooltips should not be the only source of essential information.

## 12. Content tone

Use concise, friendly, professional language.
Examples:
- “Start with a template”
- “Create from blank”
- “Drag a visual onto the canvas”
- “Use this design”
- “Your changes are saved”
- “Sample data — replace with your own data later”

Avoid technical jargon in business-user-facing screens.
