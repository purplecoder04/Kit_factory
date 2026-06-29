# Kit Factory Markdown Format Guide

Use this format when pasting text into Kit Factory. The app uses the page markers and labels to know where each page starts, what the title is, and which lines should become fillable boxes.

## 1. Start with kit details

Put this at the very top of the file:

```md
---
title: Your Kit Title
branch: brand
product_type: workbook
output_mode: split
---
```

You can change `title` to the real kit name.

Common `branch` choices:

- `brand`
- `rise`
- `land`
- `rebuild`
- `meetatheal`
- `umbrella`

Common `product_type` choices:

- `workbook`
- `mini-guide`
- `digital-kit`
- `checklist`
- `template-bundle`

Use `output_mode: split` when you want the kit broken into separate pages.

## 2. Start every page with a PAGE marker

Every new page must start with a marker like this:

```md
<!-- PAGE: workbook -->
```

Supported page types:

- `cover`
- `how-to-use`
- `important-to-know`
- `lesson`
- `workbook`
- `checklist`
- `tracker`
- `reflection`
- `closing`

If the text is showing up as one big block, it usually means the page markers are missing or the text was pasted without the markers.

## 3. Use labels inside each page

These labels tell the app what each line is:

```md
SECTION: Workbook
TITLE: Your Business Setup Roadmap
BOTTOM_NOTE: Write the answer you can use this week.
```

Only use these exact labels:

- `SECTION:`
- `TITLE:`
- `PROMPT:`
- `BOTTOM_NOTE:`

## 4. Use PROMPT for fillable answers

Each fillable answer box needs its own `PROMPT:` line:

```md
PROMPT: The first thing I really need to handle is:
PROMPT: The thing that feels urgent but can probably wait is:
PROMPT: The decision that would make the next step easier is:
```

Fillable pages are:

- `workbook`
- `checklist`
- `tracker`
- `reflection`

Lesson pages and how-to pages are regular reading pages, so they usually use normal paragraphs and bullet lists instead of prompts.

## 5. Basic page example

```md
<!-- PAGE: lesson -->
SECTION: Lesson
TITLE: Your Business Setup Roadmap
Before a brand can look polished, the business underneath it needs a simple shape.

Start with the offer, the audience, and the next decision your buyer needs to make.

BOTTOM_NOTE: Beginner mistake to avoid: trying to build every system at once.
```

## 6. Fillable page example

```md
<!-- PAGE: workbook -->
SECTION: Workbook
TITLE: Your Business Setup Roadmap
PROMPT: The first thing I really need to handle is:
PROMPT: The thing that feels urgent but can probably wait is:
PROMPT: The decision that would make the next step easier is:

BOTTOM_NOTE: Write the answer you can act on, not the answer that sounds most impressive.
```

## Quick rule

One page marker creates one page. One `PROMPT:` line creates one fillable answer area.
