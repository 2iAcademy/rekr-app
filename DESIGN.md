---
name: Rekr
description: Mutual-match hiring app — the category standard, played straight, one ink-violet accent on a cool grey ground.
colors:
  ink-violet: "#5b3fd6"
  ink-violet-strong: "#4a31b8"
  ink-violet-tint: "#eeeafd"
  cool-ground: "#f6f6f8"
  card-white: "#ffffff"
  quiet-surface: "#f3f4f6"
  hairline: "#e5e7eb"
  field-stroke: "#d7dae0"
  ink: "#111827"
  ink-soft: "#374151"
  ink-muted: "#525a68"
  ink-faint: "#656d7b"
  success: "#047857"
  success-tint: "#d1fae5"
  warning: "#92400e"
  warning-tint: "#fef3c7"
  destructive: "#c8321f"
  destructive-tint: "#fdecea"
typography:
  display:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.5
  body:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  lead:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  tab-label:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
  wordmark:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  md: "8px"
  lg: "10px"
  xl: "14px"
  card: "18px"
  full: "9999px"
spacing:
  row: "10px"
  gap: "12px"
  gutter-phone: "16px"
  card-pad: "20px"
  card-pad-wide: "24px"
  gutter-tablet: "40px"
  gutter-desktop: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink-violet}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.lead}"
  button-primary-hover:
    backgroundColor: "{colors.ink-violet-strong}"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.quiet-surface}"
  button-page-action:
    backgroundColor: "{colors.ink-violet}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "48px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  option-selected:
    backgroundColor: "{colors.ink-violet-tint}"
    textColor: "{colors.ink-violet-strong}"
    rounded: "{rounded.xl}"
    height: "44px"
  option-idle:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "44px"
  chip-skill:
    backgroundColor: "{colors.quiet-surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  chip-filter:
    backgroundColor: "{colors.ink-violet-tint}"
    textColor: "{colors.ink-violet-strong}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  status-positive:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  nav-item-active:
    backgroundColor: "{colors.ink-violet-tint}"
    textColor: "{colors.ink-violet-strong}"
    rounded: "{rounded.lg}"
    height: "44px"
  tab-bar:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-faint}"
    height: "64px"
  match-badge:
    backgroundColor: "{colors.ink-violet}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: Rekr

## Overview

**Creative North Star: "The Straight Ledger"**

Rekr is the category standard executed with care: a cool, near-white ground, white cards that lift just off it, and decisions laid out as aligned label/value rows separated by hairlines. Nothing is a metaphor. A job offer, a candidate and a match all read the same way: who, what, then the facts that decide it, each on its own ruled line, value flush right in bold so a missing one shows as a gap rather than hiding in a sentence.

One accent carries the whole product. Ink violet marks what you can do next (the primary action, the active tab, a selected option, a link, the match badge) and nothing else. Candidates and recruiters get the same palette and the same components; which side you are on reads from navigation and content, never from colour. Status (published, paused, closed, error) uses semantic greens, ambers and reds that are never borrowed for decoration.

The density is calm and phone-first: one card per decision, 20px of card padding, 10px rows, generous 48px thumb targets for the two decision buttons. Motion is almost absent; the match screen is the one place anything moves.

**Key Characteristics:**

- Cool grey ground (#f6f6f8), white 18px cards with a soft, low offset shadow and a hairline border.
- Hairline label/value rows as the signature: muted label left, bold value right, tabular figures.
- Each detail screen is ONE card, its sections split by hairlines rather than stacked cards.
- One accent, ink violet, shared by both audiences; semantic colours only for status.
- Manrope everywhere, 800 for headings with tight tracking (-0.02em).
- Bottom tab bar on phones, the header with inline nav from tablet width up, at every larger width too.
- One motion moment: the match screen's avatars settling together.

## Colors

A neutral cool-grey system with a single ink-violet accent and a small, strictly semantic status set.

### Primary

- **Ink Violet** (ink-violet): the primary action fill (Ça m'intéresse, Écrire un message, Publier), the active tab underline, focus rings (at 30% for buttons, 20% for fields), text caret, the dot of the wordmark, the match badge.
- **Deep Ink Violet** (ink-violet-strong): hover state of primary fills; the text colour on anything sitting on the tint (active nav label, selected option, filter chip, avatar initials) and on inline links such as "Voir l'offre complète".
- **Violet Wash** (ink-violet-tint): background of the active nav item, a selected option card or chip, filter chips, initials avatars, and text selection.

### Neutral

- **Cool Ground** (cool-ground): the page background behind every screen.
- **Card White** (card-white): cards, the header, the tab bar, inputs, outline buttons, sticky action bars.
- **Quiet Surface** (quiet-surface): hover fill for ghost and outline controls, skill chips, segmented-control tracks, skeleton blocks, idle icon discs.
- **Hairline** (hairline): every border and divider: card outlines, row rules, header and tab-bar edges.
- **Field Stroke** (field-stroke): the slightly heavier border of outline buttons and select fields.
- **Ink** (ink): headings, values, primary text.
- **Ink Soft** (ink-soft): skill-chip text, neutral status text, idle option icons.
- **Ink Muted** (ink-muted): row labels, meta lines (size · city), descriptions, helper copy.
- **Ink Faint** (ink-faint): idle tab-bar labels and icons, the quietest text.

### Status

- **Go Green** (success on success-tint): published offer, positive confirmation.
- **Caution Amber** (warning on warning-tint): paused offer. Taken from Tailwind's amber-800/amber-100 in the build rather than a custom property.
- **Stop Red** (destructive on destructive-tint): errors, closing or ending actions (the destructive button is a tinted fill, not a solid red).

A dark theme is defined under `.dark` (brand lifts to #8b76ec, ground #111318, cards #181b21); the light theme above is the reference.

### Named Rules

**The One Ink Rule.** Ink violet appears only on the primary action, the active navigation item, a selected option or filter, a link, and the match badge. If it is on anything else, it is wrong.

**The Status Is Not Brand Rule.** Green, amber and red mean state (published, paused, error). They are never used as decoration, and violet never signals a status.

**The Shared Palette Rule.** Candidates and recruiters see identical colours. Role reads from navigation and content, not from a role colour.

## Typography

**Display Font:** Manrope Variable (with ui-sans-serif, system-ui)
**Body Font:** Manrope Variable (same family)

**Character:** One humanist-geometric family carries everything. Weight does the hierarchy: 800 for headings and titles, 700 for values and names, 600 for labels and controls, 400 for body. Headings track in at -0.02em and balance their lines.

### Hierarchy

- **Display** (800, 1.75rem, 1.25): the match headline and page titles from tablet up.
- **Headline** (800, 1.5rem, 1.25): page titles on phones (Mes offres, Matchs, Profil), splash headline.
- **Title** (800, 1.25rem to 1.5rem from sm, tight): the offer or candidate title inside a card.
- **Section** (800, 1rem): the rubric above a block of detail (SectionTitle), shared by both sides.
- **Body** (400, 0.875rem, relaxed): row text, descriptions, form text. Row values use 700 with tabular figures.
- **Lead** (400, 0.9375rem, relaxed): the one-line explanation under a headline; also the decision-button label size (700).
- **Label** (600, 0.75rem): meta lines, status badges, progress captions, small chips.
- **Tab label** (600, 0.6875rem): bottom tab-bar captions under their icons.

### Named Rules

**The Weight Not Size Rule.** Hierarchy comes from Manrope's weights before sizes; the ramp stays between 0.6875rem and 1.75rem.

**The Tabular Rule.** Salaries, counts, dates and positions use tabular figures so stacked numbers align.

**The Lowercase Wordmark Rule.** The logo is the word "rekr" in Manrope 800 at -0.04em tracking, followed by a violet full stop. No uppercase, no other lettering treatment.

## Layout

Mobile-first at 375px, with one structural switch: `md` (768px). `desktop` (1440px) only widens a few page measures.

- **Phone (<768px):** a sticky 60px white header with the wordmark left and the account avatar right; destinations live in a fixed 64px bottom tab bar (plus the safe-area inset). Page gutter 16px (24px from 640px).
- **Tablet and desktop (≥768px):** the tab bar disappears and the destinations join the header inline, left-aligned after the wordmark, with the avatar and the logout icon on the right. Header content and page content share one centred column capped at 72rem (1152px); gutter 40px. There is no sidebar: with three or four destinations a top bar keeps the navigation in the same place at every width, and leaves the full width to two-pane screens such as messaging.

The shell exposes `--tabbar-h` (64px + safe area on phones, 0 from tablet). Sticky action bars (candidate decision, offer form save) sit at `bottom: var(--tabbar-h)` so they rest on the tab bar, not under it; on phones they bleed edge to edge with a top hairline; from tablet they become a rounded card on the content column, 16px above the viewport edge, with a 16px square band of the ground behind them (`float-bar`) so the content scrolling underneath is cut off in a straight line before reaching them. The main column reserves `var(--tabbar-h) + 32px` of bottom padding.

Content columns are narrow: detail screens cap at 32rem, splash and match at 28rem. Rhythm: 20px card padding (24px from sm), 16px between blocks inside a card, 12px between stacked cards or buttons, 10px vertical row padding.

**The Tab Bar Floor Rule.** Anything fixed or sticky to the bottom reads `--tabbar-h`; nothing hard-codes the tab bar's height.

## Elevation & Depth

A light hybrid: every card carries both a hairline border and a very soft, downward-offset shadow, so it lifts barely off the cool ground. There are two levels only.

### Shadow Vocabulary

- **Card** (`0 1px 2px rgb(17 24 39 / 0.04), 0 6px 20px -12px rgb(17 24 39 / 0.22)`): every card and list container.
- **Raised** (`0 12px 32px -14px rgb(17 24 39 / 0.32)`): toasts and the match screen avatars.
- **Float** (same values as Card, used through `shadow-float` with the `float-bar` band): sticky action bars from tablet width up.

### Named Rules

**The Two Heights Rule.** Surfaces are either on the ground (header, tab bar: flat, divided by hairlines) or on a card (shadow-card). Raised is reserved for things that arrive: a toast, the match.

**The No Glass Rule.** No gradients, no blur, no translucency. Depth comes from white on cool grey plus one soft shadow.

## Shapes

Soft, consistent corners in three steps, with circles for people.

- **Cards** (18px): every card, list container, accordion and skeleton block.
- **Controls** (14px): decision buttons, page actions, inputs, selects, option cards, segmented tracks, back buttons, error notes.
- **Navigation items** (10px): header nav pills.
- **Chips** (8px) for skills and filters inside cards; **full pills** for status badges, the match badge and small chips.
- **Circles** for every avatar (48px on the feed card, 56/80px on detail headers, 88px on the match screen) and for icon discs.

The brand mark is two outlined circles (the candidate and the company) whose overlap alone is filled violet: the match.

## Components

### Buttons

Plain, confident, filled or outlined; never gradient.

- **Shape:** gently rounded (14px) at the two working sizes.
- **Primary:** ink-violet fill, white label, 700 at 0.9375rem, 48px tall with 24px side padding and a 20px Lucide icon. Hover deepens to ink-violet-strong.
- **Outline:** white fill, field-stroke border, ink label; hover fills quiet-surface. Paired 50/50 with the primary for the Passer / Ça m'intéresse decision.
- **Page action:** 44px tall, 20px side padding, primary or outline (Nouvelle offre, Modifier).
- **Ghost:** transparent, quiet-surface on hover (Continuer à swiper).
- **Destructive:** stop-red text on a 10% red wash, darkening to 20% on hover.
- **Focus / press:** a 3px violet ring at 30%; a 1px press-down on active; 50% opacity when disabled.

### Chips

- **Skill chips:** quiet-surface fill, ink-soft text, 8px corners; the subject's own words, kept neutral.
- **Filter chips:** violet-wash fill, deep-violet text; what the reader filters on (contract, languages).
- **Status badge:** full pill with a 6px leading dot in the current colour, semantic tone per status; announced as « Statut : … ».

### Cards / Containers

- **Corner Style:** 18px.
- **Background:** card-white on the cool ground.
- **Shadow Strategy:** shadow-card, always paired with a hairline border.
- **Internal Padding:** 20px, 24px from 640px; list containers use hairline dividers between rows instead of padding gaps.

### Inputs / Fields

- **Style:** 48px tall, white, hairline border, 14px corners, 16px side padding, muted placeholder.
- **Focus:** border turns ink violet with a 3px violet ring at 20%.
- **Error:** stop-red border and a 3px red ring at 20%; form-level errors sit in a destructive-tint note with 14px corners.
- **Options (radio/checkbox cards):** 44px minimum, hairline border; selected turns to violet wash with a violet border, deep-violet label and a check icon. With an icon or description they stack into 72px cards with a 40px icon disc.

### Navigation

- **Bottom tab bar (phone):** white, top hairline, 64px, icon over a 0.6875rem label. Active tab: deep-violet label and a 2px × 32px violet bar at the top edge; idle tabs ink-faint.
- **Header nav (tablet):** centred pills, 44px targets; active is violet wash with deep-violet text, idle ink-muted with a quiet-surface hover.

### Hairline Ledger (signature)

The label/value row block that decides everything. A description list opened by a top hairline (or sitting inside a hairline-divided card); each row is baseline-aligned, label left in ink-muted, value right in ink 700 with tabular figures, 10px vertical padding and a hairline below. Used on the feed card (contract, rhythm, experience, salary), the offer detail's "En bref", the candidate detail and the match recap.

### One-Card Detail

Offer detail and candidate detail are a single card split into sections by hairline dividers: identity header (avatar, name, size · city, title), the ledger, then text sections under 1rem/800 rubrics. The decision or edit action sits in a sticky bar beneath, resting on `--tabbar-h`.

### Match Moment

Full-screen white takeover. Two 88px circular avatars overlap by 24px with a 4px white ring and the raised shadow; they fade and slide in from either side over 500ms on `cubic-bezier(0.16, 1, 0.3, 1)`, then the violet "Intérêt réciproque" pill fades in 150ms later. A calm 1.75rem headline, one line of muted copy, the offer recap as a ledger card, and the primary + ghost buttons at the foot. All motion is behind `motion-safe`; the resting layout is the plain layout.

### Brand

The "rekr." wordmark (violet full stop) in the header; the two-circle mark beside it on the splash only.

## Do's and Don'ts

### Do:

- **Do** lay decision facts out as hairline label/value rows, bold value flush right, tabular figures.
- **Do** build each detail screen as ONE 18px card with sections split by hairline dividers.
- **Do** keep ink violet to the primary action, active nav, selected option or filter, links and the match badge.
- **Do** pair every card's hairline border with shadow-card; reserve the raised shadow for toasts and the match.
- **Do** anchor every bottom-sticky bar at `var(--tabbar-h)`.
- **Do** give touch targets at least 44px, and the two feed decisions 48px, equal width, outline left and primary right.
- **Do** use Lucide icons at 16 to 20px, `aria-hidden`, always next to a word.
- **Do** address people as "vous" on every screen, candidates and recruiters alike (decided 2026-09-21: the audience spans every profile and every company size); shared helpers may use an infinitive instead. Never "tu".

### Don't:

- **Don't** give candidates and recruiters different colours; the role reads from navigation and content.
- **Don't** use gradients, glass, blur or translucency on any surface.
- **Don't** stack several cards to build one detail screen, or pile facts into chips when they belong in rows.
- **Don't** use green, amber or red for anything but status.
- **Don't** animate anything outside the match screen beyond colour transitions and skeleton pulses.
- **Don't** add a second typeface or uppercase tracked labels.
