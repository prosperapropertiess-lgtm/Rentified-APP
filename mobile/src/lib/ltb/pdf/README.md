# LTB PDF generation — status

**These are NOT official Tribunals Ontario forms.** No real government AcroForm
PDF was sourced or field-mapped tonight (that requires real access to the
current official PDF and careful verification per spec sections 26/27/69).

What exists instead: an HTML→PDF renderer (via `expo-print`) that lays out
the same structured data a real N4/N5 would need, clearly watermarked
**"DRAFT — NOT AN OFFICIAL LTB FORM — DO NOT SERVE THIS DOCUMENT"** on every
page. This gives real, working PDF generation/download/storage end-to-end
(spec section 71 requires this in the acceptance test) without pretending to
be a government document.

## Swapping in the real official PDF later

1. Source the current official N4/N5 PDF from Tribunals Ontario.
2. Determine if it's a standard fillable AcroForm (check with a PDF field
   inspector) — if so, use a PDF field-filling library (e.g. `pdf-lib`,
   which runs fine in Deno/Edge Functions) mapped via `ltb_form_templates.field_map`.
3. If it's not programmatically fillable, build a coordinate-based overlay
   instead — never redraw the government form's static text/layout from
   scratch.
4. Set `ltb_form_templates.is_official_pdf = true` and `status = 'active'`
   only after that's verified working, and only then stop using the draft
   HTML renderer for that form.
