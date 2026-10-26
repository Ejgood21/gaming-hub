# Reusable per-patch Codex task

The full WoW app and extraction rubric are a separate build. Use this prompt only after that work has landed. Replace the bracketed fields and paste into a new Codex task:

---

Refresh the Personal Gaming Hub's WoW Spec Playstyle Compass for **[patch/version]**, as of **[date]**.

1. Read repository instructions, `apps/wow/README.md`, and `pipeline/extract-playstyle.md`. If the full WoW app, collectors, or extraction rubric do not exist, report what is missing and stop the refresh; do not invent a pipeline or profiles.
2. Inspect the existing data format, sources, and refresh commands. Run only the documented collectors needed for this patch. Read any required `YOUTUBE_API_KEY`, `WCL_CLIENT_ID`, and `WCL_CLIENT_SECRET` from the environment supplied by my Codex Personal vault. Never print or commit their values. Keep raw collector outputs outside the static export.
3. You, the Codex agent on my ChatGPT subscription, are the LLM extraction step. Read the collected public raw material, apply `pipeline/extract-playstyle.md`, and write the profiles JSON to the documented location. Do not call a paid LLM API, use Gemini Flash or another Flash-class extraction model, add an external LLM provider, or require an external LLM API key.
4. Preserve uncertainty, cite sources in the supported format, distinguish patch-specific facts from inference, and flag missing or contradictory evidence. Do not invent a profile to fill a gap.
5. Update the WoW card's last-updated date after a successful refresh. Run the existing validation, static build, and app smoke checks, including reading without JavaScript. Confirm that the output contains only public data and no credentials or raw private material.
6. Open a PR into `main` with the patch, sources, changes, and validation results. Do not merge or deploy it. Keep this project separate from Weather To Wear.
