import { test, expect } from '@playwright/test'

/**
 * One-off sanity check against the REAL Supabase backend.
 *
 * Skips itself when Supabase is not configured (the Share UI is hidden because
 * the build had no VITE_SUPABASE_* env). It exercises the real round-trip:
 * create a link (upload to `tenji-snapshots`) → open it in a fresh browser
 * context (public read-back) → the shared plan renders.
 *
 * Note: each run leaves a snapshot in the bucket (anon can insert, not delete);
 * clean up from the Supabase dashboard if desired.
 */
test('share round-trip via real Supabase', async ({ page, browser }) => {
  await page.goto('/')
  await expect(page.getByTestId('wall')).toBeVisible()

  const createBtn = page.getByRole('button', { name: /create shareable link/i })
  if ((await createBtn.count()) === 0) {
    test.skip(true, 'Supabase not configured (Share UI hidden) — set VITE_SUPABASE_* and rebuild.')
    return
  }

  // Make the plan distinctive (a second wall) so we can tell the shared plan
  // apart from a fresh context's default single wall.
  await page.getByRole('button', { name: /add wall/i }).click()
  await expect(page.getByText('Wall 2')).toBeVisible()

  await createBtn.click()
  const field = page.getByTestId('project-share-url')
  await expect(field).toBeVisible({ timeout: 20_000 })
  const url = await field.inputValue()
  expect(url).toContain('#share=')

  // Open the link in a fresh, empty context (no prior plan → no confirm).
  const ctx = await browser.newContext()
  const page2 = await ctx.newPage()
  page2.on('dialog', (d) => d.accept())
  await page2.goto(url)
  // The shared plan has two walls; a fresh default would only have "Wall 1".
  await expect(page2.getByText('Wall 2')).toBeVisible({ timeout: 20_000 })
  await ctx.close()
})
