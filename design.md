---
version: alpha
name: ClickUp Modern Workspace
description: A bright, productivity-first SaaS system with crisp contrast, soft surfaces, and a confident accent.
colors:
  primary: "#202020"
  primary-accent: "#5f55ee"
  secondary: "#f0f0f0"
  tertiary: "#646464"
  neutral: "#ffffff"
  surface: "#ffffff"
  surface-muted: "#f8f8f8"
  border: "#e8e8e8"
  text: "#202020"
  text-muted: "#646464"
  on-surface: "#292d34"
  success: "#26b36a"
  warning: "#ff7a45"
  error: "#d83a3a"
typography:
  headline-display:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 60px
    fontWeight: 700
    lineHeight: 66px
    letterSpacing: -0.035em
  headline-lg:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 47px
    fontWeight: 650
    lineHeight: 60px
    letterSpacing: -0.03em
  headline-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 36px
    fontWeight: 650
    lineHeight: 43px
    letterSpacing: -0.025em
  headline-sm:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 28px
    fontWeight: 650
    lineHeight: 34px
    letterSpacing: 0em
  body-xl:
    fontFamily: "Inter"
    fontSize: 22px
    fontWeight: 400
    lineHeight: 33px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: "Inter"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: -0.015em
  body-md:
    fontFamily: "Inter"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: -0.01em
  body-sm:
    fontFamily: "Inter"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: -0.01em
  label-lg:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 18px
    fontWeight: 650
    lineHeight: 24px
    letterSpacing: 0em
  label-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 22px
    letterSpacing: 0em
  label-sm:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0em
  label-caps:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 15px
  full: 9999px
spacing:
  xs: 2px
  sm: 10px
  md: 18px
  lg: 30px
  xl: 80px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.label-md}"
    rounded: "{rounded.xl}"
    padding: "14px 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "#2a2a2a"
    textColor: "{colors.neutral}"
    rounded: "{rounded.xl}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.xl}"
    padding: "14px 20px"
    height: "52px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: "0px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "10px 14px"
  chip:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  sidebar:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.none}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.none}"
---

# ClickUp Modern Workspace

## Overview
ClickUp presents itself as a confident, high-performance productivity platform: polished, modern, and clearly built for teams that want speed without visual noise. The experience feels spacious and airy, with a large hero area, generous whitespace, and a strong editorial headline treatment that gives the brand a premium SaaS tone. The UI balances approachability and utility through soft neutrals, rounded controls, and a single vivid accent color.

## Colors
- **Primary (#202020):** A deep charcoal used for the main brand text, primary buttons, navigation emphasis, and dark sidebar surfaces. It gives the interface structure and keeps the design grounded.
- **Primary Accent (#5F55EE):** A lively indigo-purple used as the signature accent for small highlights, product marks, and interactive cues. It adds energy without overpowering the calm layout.
- **Secondary (#F0F0F0):** A soft gray used for secondary button fills and subtle control surfaces. It supports hierarchy while staying quiet.
- **Tertiary (#646464):** A medium gray used for body copy, navigation text, and supportive interface labels. It creates readable but low-drama contrast.
- **Neutral (#FFFFFF):** The dominant page and surface color. It keeps the workspace feeling open, modern, and lightweight.
- **Surface (#FFFFFF):** A clean card and panel base used for containers, menus, and content blocks.
- **Surface Muted (#F8F8F8):** A faint off-white used for subtle backgrounds, chips, and restrained UI accents.
- **Border (#E8E8E8):** A delicate divider color used for cards, tables, and structural rules.
- **Text (#202020):** The main foreground color for strong readable content and primary actions.
- **Text Muted (#646464):** A supporting text color for descriptions, metadata, and secondary labels.
- **On Surface (#292D34):** A slightly softer near-black used on cards and embedded panels to reduce harshness.
- **Success (#26B36A):** A positive status green for completion and done states.
- **Warning (#FF7A45):** A warm alert tone for urgency and high-priority indicators.
- **Error (#D83A3A):** Reserved for destructive states and error messaging.

## Typography
The system is anchored by **Plus Jakarta Sans** for headlines, navigation, labels, and interface chrome. Headings are bold, tightly tracked, and compact, with large sizes that create a clear editorial hierarchy; the display style is especially prominent in the hero. **Inter** is used for body copy and supporting text, giving paragraphs a neutral, highly legible feel that works well in product marketing and dense workspace UI. The small uppercase-like label treatment uses slightly increased letter spacing to improve clarity in compact UI contexts.

Use `headline-display`, `headline-lg`, and `headline-md` for marketing banners and major page titles. Use `headline-sm` for smaller section headings or card titles. Use `body-xl`, `body-lg`, `body-md`, and `body-sm` for explanatory text, helper content, and dense interface copy. Use `label-lg`, `label-md`, `label-sm`, and `label-caps` for buttons, nav items, chips, and metadata.

## Layout
The layout relies on a centered, fixed-max-width hero and content column with large outer whitespace, making the page feel intentionally spacious rather than full-bleed. Major sections are separated by vertical breathing room rather than heavy dividers, and the rhythm follows a loose scale built from `xs` through `xl`. The UI uses generous internal padding in cards and panels, with especially comfortable spacing around primary actions and product screenshots.

Navigation and top-level product chrome are compact, while the marketing content expands with wide typographic blocks and ample gap between headline, supporting copy, and CTA row. In-app surfaces use tighter organization: left rail, central list, and right-side panel are arranged in a dense multi-column workspace pattern, but still preserve clear gutters and consistent alignment.

## Elevation & Depth
The design is mostly flat and relies on contrast, borders, and tonal separation instead of dramatic shadows. Cards and containers are defined with subtle `#E8E8E8` borders and clean white fills, while the dark sidebar and primary CTA create depth through color inversion rather than elevation. Where shadow appears, it is restrained and functional, supporting floating affordances without making the interface feel heavy.

This flat approach reinforces the product’s efficiency and keeps attention on content, status, and task structure.

## Shapes
The shape language is soft and approachable, with rounded corners used on buttons, inputs, chips, and key cards. The primary radius feels intentionally relaxed at `15px` for buttons, while smaller structural containers and cards use gentler rounding such as `12px` or fully pill-shaped forms. Overall, the system blends human-friendly curves with a clean SaaS precision.

## Components
**Buttons:** Primary buttons should use `button-primary` with a dark fill, white text, and the `label-md` typographic treatment. Secondary buttons should use `button-secondary` with a light gray fill and dark text. Link-style actions should use `button-link` with no fill and minimal padding. Buttons are medium-large, with a fixed height around `52px` and padding close to `14px 20px`, making them feel substantial and easy to scan. Hover states should stay subtle; the primary button can darken slightly via `button-primary-hover` rather than changing shape or introducing heavy motion.

**Cards:** Use `card` for content containers, with a white background, thin border, and `rounded.lg` corners. Cards should feel clean and modular, not shadow-heavy. Use 20px interior padding as the default for panels, lists, and surfaces that need separation from the page background.

**Inputs:** Inputs are soft and understated, typically pill-shaped with a white background and light border treatment implied by surrounding structure. Keep them compact but readable, using `body-md` or `label-sm` text. Search fields and filters should feel embedded rather than dominant.

**Chips and status pills:** Use `chip` for status labels like In Progress, Open, and Done. Chips should be compact, rounded-full, and lightly filled, with strong text contrast and minimal padding. Status colors can be introduced sparingly for semantic meaning, but the form itself should remain quiet and consistent.

**Sidebar and panels:** The sidebar should use `sidebar`, with a dark background and white text/icons, creating a strong anchor in the workspace. Secondary panels should use `panel` or `card` depending on whether they are structural or content-driven. Side panels should feel organized and calm, with borders and whitespace doing most of the work.

**Tables and lists:** Dense list rows should keep clear vertical separators, muted column labels, and a consistent row height. Use small status markers, icons, and avatars to add hierarchy without clutter.

## Do's and Don'ts
- Do keep the page airy, with large headline spacing and generous whitespace around primary marketing content.
- Do use Plus Jakarta Sans for headlines, labels, and navigation, and Inter for body copy.
- Do prefer flat surfaces with subtle borders over heavy shadows or glossy effects.
- Do keep primary actions dark and secondary actions light, with strong contrast between them.
- Do use rounded corners consistently, especially on buttons, chips, and search inputs.
- Don't introduce saturated colors beyond the accent and semantic status colors unless they support meaning.
- Don't compress the layout too tightly; this system depends on breathing room to feel premium.
- Don't over-style cards with shadows, gradients, or ornate decoration; clarity is the priority.
