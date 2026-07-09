# Kit Factory Markdown Format Guide

Use this format when pasting text into Kit Factory. The app reads the frontmatter, page markers, and field labels to build PDFs, fillable workbooks, packages, and website mockups.

Before writing or generating a full kit, choose the branch identity, design preset, and product flow separately. See `docs/best-collective-branch-system.md` for the Best Collective branch philosophy, product-flow rules, and Meet at the Heal package structure.

## 1. Kit Details

Put this at the top of every markdown file:

```md
---
title: Your Kit Title
subtitle: Your short promise or collection line
branch: brand
design_preset: brand
product_type: workbook
output_mode: split
author: Best Collective
tagline: Your closing promise
slug: your-kit-slug
---
```

`branch` controls the product identity, footer, and file naming. `design_preset` controls the colors, page styling, icons, decorative system, fillable colors, and mockup styling.

Approved branches:

- `umbrella`
- `brand`
- `rise`
- `land`
- `rebuild`
- `meetatheal`

Approved design presets:

- `brand`
- `brand-land`
- `rise`
- `land`
- `rebuild`
- `meetatheal`
- `meetatheal-rise`
- `meetatheal-land`
- `umbrella`

If `design_preset` is missing, the app uses the standard preset for the selected branch.

Approved product types:

- `workbook`
- `mini-guide`
- `digital-kit`
- `checklist`
- `template-bundle`

Approved output modes:

- `split`
- `all-in-one`

## 2. Page Markers

Every page starts with a page marker:

```md
<!-- PAGE: workbook -->
```

Supported page types:

| Page type slug | Page name | Main purpose | Fillable? |
| --- | --- | --- | --- |
| `cover` | Cover Page | Front cover and product title | No |
| `welcome` | Welcome Page | Intro, promise, and quick outcomes | No |
| `toc` | Table of Contents Page | Chapter/section list | No |
| `quote` | Quote / Inspiration Page | Large editorial quote or reminder | No |
| `section-divider` | Section Divider Page | New chapter or part opener | No |
| `how-to-use` | How To Use Page | Instructions for using the kit | No |
| `important-to-know` | Important To Know / Alert Page | Required context, disclaimer, or warning | No |
| `lesson` | Lesson Content Page | Teaching content with bullets and key terms | No |
| `lesson-continue` | Lesson Continuation / Reflection Page | Second lesson page or reflection teaching page | No |
| `workbook` | Workbook Prompt Page | Fillable writing prompts | Yes |
| `checklist` | Checklist Page | Fillable checklist rows and optional notes | Yes |
| `tracker` | Tracker / Table Page | Fillable table rows | Yes |
| `action-plan` | Action Plan Page | Fillable action prompts and deadline questions | Yes |
| `notes` | Notes Page | Fillable lined notes page | Yes |
| `reflection` | Reflection Page | Non-fillable thinking prompts | No |
| `progress-check` | Progress Check Page | Non-fillable completion checks before moving on | No |
| `resource` | Resource Page | Links, key terms, warnings, and reference notes | No |
| `case-study` | Case Study / Story Page | Real story, example, and takeaway | No |
| `closing` | Closing / Next Steps Page | Final action, review, or next-step instructions | No |
| `back-cover` | Back Cover Page | Final branded end page | No |

The first page should be `cover`. The last page should be `back-cover`.

For a layout test file, use one page for each page type. That creates a clean 20-page test kit.

## 2A. Recommended Test Kit Size

For layout testing, use:

- 20 pages total: one page for each supported page type.
- 15 chapters in the table of contents: enough to test long TOC spacing without making the sample huge.
- 3-4 prompts on workbook and action-plan pages.
- 6-8 checks on checklist and progress-check pages.
- 8-10 rows on tracker pages.

I recommend 15 chapters, not 20, for the normal layout test. Fifteen catches most spacing problems and still stays easy to review. Use 20 only when you want a stress test for very long products.

## 2B. Prompt For Claude Or ChatGPT

Use this prompt when asking another AI to generate test content:

```text
Create a Kit Factory markdown test sample using the exact format below.

Goal:
Generate one page for every supported Kit Factory page type so I can test the PDF layouts.

Rules:
- Use the exact page marker slugs from the list.
- Do not invent new page types.
- Keep all fields in ALL CAPS exactly as shown.
- Use 15 table-of-contents chapter entries.
- Make the content realistic but short enough to fit cleanly.
- Use 3 workbook prompts.
- Use 6 checklist items.
- Use 8 tracker rows.
- Use 3 action prompts and 1-2 deadline questions.
- REFLECT fields are non-fillable.
- CHECK fields are fillable only on checklist pages.
- End with a closing page, then a back-cover page.

Supported page types:
1. cover
2. welcome
3. toc
4. quote
5. section-divider
6. how-to-use
7. important-to-know
8. lesson
9. lesson-continue
10. workbook
11. checklist
12. tracker
13. action-plan
14. notes
15. reflection
16. progress-check
17. resource
18. case-study
19. closing
20. back-cover

Return only the markdown file content.
```

## 3. Field Labels

Use these labels exactly:

- `SECTION:`
- `TITLE:`
- `SUBTITLE:`
- `TAGLINE:`
- `BOTTOM_NOTE:`
- `PROMPT:`
- `CHECK:`
- `QUOTE:`
- `QUOTE_BY:`
- `ATTRIBUTION:`
- `KEY_TERM:`
- `KEY_TERM_BODY:`
- `ALERT:`
- `NOTE_LABEL:`
- `TABLE_HEADERS:`
- `TABLE_ROWS:`
- `ACTION:`
- `QUESTION:`
- `STORY_LABEL:`
- `STORY:`
- `TAKEAWAY:`
- `IMAGE_SLOT:`
- `ICON:`
- `REFLECT:`

Normal paragraphs and bullet lists can be written without labels.

## 4. Fillable Rules

Fillable fields are only created on these page types:

- `workbook`
- `checklist`
- `tracker`
- `action-plan`
- `notes`

Use `PROMPT:` only on `workbook` pages. Each `PROMPT:` becomes a fillable writing area.

Use `CHECK:` on `checklist` pages for fillable checkbox rows. On lesson, welcome, progress check, and resource pages, `CHECK:` becomes a styled non-fillable bullet.

Use `REFLECT:` for thinking prompts. `REFLECT:` is always non-fillable, even when it appears on a fillable page.

## 5. Common Page Examples

### Cover

```md
<!-- PAGE: cover -->
TITLE: Your Kit Title
SUBTITLE: Your short promise
TAGLINE: Your final promise
IMAGE_SLOT: cover-lifestyle
ICON: branch-default
```

### Welcome

```md
<!-- PAGE: welcome -->
SECTION: Welcome
TITLE: You're in the right place.
This guide will help the reader understand what to do next.

CHECK: First outcome.
CHECK: Second outcome.
CHECK: Third outcome.

BOTTOM_NOTE: Add a short reminder here.
```

### Table Of Contents

```md
<!-- PAGE: toc -->
TITLE: Table of Contents
01 | First Section | 1
02 | Second Section | 11
Resources | 81
Notes | 87
```

### Quote

```md
<!-- PAGE: quote -->
QUOTE: Your foundation does not have to be fancy. It has to be clear enough to use.
ATTRIBUTION: Best Collective
```

### Section Divider

```md
<!-- PAGE: section-divider -->
SECTION: Section 01
TITLE: Section Title
SUBTITLE: Short section promise.
IMAGE_SLOT: section-lifestyle
```

### Lesson

```md
<!-- PAGE: lesson -->
SECTION: Lesson 01
TITLE: Lesson Page Title
Write the lesson content here.

CHECK: Non-fillable teaching bullet.
CHECK: Another non-fillable teaching bullet.

KEY_TERM: Registered Agent
KEY_TERM_BODY: A person or service that receives official legal and government documents on behalf of your business.

BOTTOM_NOTE: Add the lesson takeaway here.
```

### Workbook

```md
<!-- PAGE: workbook -->
SECTION: Workbook
TITLE: Workbook Page Title
PROMPT: First fillable question goes here:
PROMPT: Second fillable question goes here:
PROMPT: Third fillable question goes here:

BOTTOM_NOTE: Add a reminder here.
```

### Checklist

```md
<!-- PAGE: checklist -->
SECTION: Checklist
TITLE: Checklist Page Title
CHECK: First fillable checklist item.
CHECK: Second fillable checklist item.
CHECK: Third fillable checklist item.

NOTE_LABEL: Notes to myself:
```

### Tracker

```md
<!-- PAGE: tracker -->
SECTION: Tracker
TITLE: Tracker Page Title
TABLE_HEADERS: Category | Goal | Actual | Notes
TABLE_ROWS:
Revenue
Expenses
Profit
Notes

NOTE_LABEL: Notes to myself:
```

### Action Plan

```md
<!-- PAGE: action-plan -->
SECTION: Action Plan
TITLE: Your Next Steps
ACTION: What are your top 3 priorities?
ACTION: What is one step you will take this week?
ACTION: What support do you need?
QUESTION: By when?
```

### Reflection

```md
<!-- PAGE: reflection -->
SECTION: Reflection
TITLE: Check In With Yourself
REFLECT: What feels clearer now?
REFLECT: What still needs a decision?
```

### Progress Check

```md
<!-- PAGE: progress-check -->
SECTION: Progress Check
TITLE: Before You Move On
CHECK: I completed the section.
CHECK: I know my next step.
CHECK: I marked anything that needs outside help.
```

### Resource

```md
<!-- PAGE: resource -->
SECTION: Resource
TITLE: Helpful Links + Notes
Use this page for official links, trusted tools, references, or extra context.

KEY_TERM: Official Source
KEY_TERM_BODY: The government, platform, provider, or professional source responsible for the requirement you are checking.

ALERT: Verify anything high-risk before acting.
```

### Case Study

```md
<!-- PAGE: case-study -->
SECTION: Real Story
TITLE: Her Story
STORY_LABEL: What happened:
STORY: Add the short story or example here.
TAKEAWAY: Add the key takeaway here.
```

### Closing / Next Steps

```md
<!-- PAGE: closing -->
SECTION: Closing
TITLE: Your Next Step
Write the final action, review, or next-step paragraph here.

CHECK: Add the first closing action.
CHECK: Add the second closing action.

TAGLINE: Add the final encouragement here.
```

### Back Cover

```md
<!-- PAGE: back-cover -->
TITLE: Best Collective
SUBTITLE: One System. Five Rooms. All For You.
TAGLINE: You are becoming everything you prayed for.
IMAGE_SLOT: closing-lifestyle
ICON: branch-default
```

## 6. Package Notes

Brand packages use the same markdown to generate two products:

- Brand Signature
- Brand Land

Meet at the Heal packages use four markdown files:

- Lesson Book
- Couples Workbook
- Rise Individual Workbook
- Land Individual Workbook

Upload all four files together or paste them into the four package tabs. Name the files so the dashboard can recognize them:

- Lesson Book: include `lesson` or `guide`
- Couples Workbook: include `couples`, `shared`, `together`, or `partner`
- Rise Individual Workbook: include `rise`, `her`, `woman`, or `women`
- Land Individual Workbook: include `land`, `his`, `man`, or `men`

See `docs/best-collective-branch-system.md` for the Meet at the Heal rule: each chapter should teach in the Lesson Book, create private Rise and Land reflection, then bring both partners together in the Couples Workbook.

## Quick Rule

One `PAGE` marker creates one page. One `PROMPT:` creates one fillable writing area. One `CHECK:` creates a fillable checkbox only on checklist pages.
