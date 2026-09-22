import { expect, test } from '@playwright/test';

/**
 * End-to-end against the SHIPPED artifact, driven like a consumer. The page
 * (`src/main.tsx`) imports only `@tai42/jq-studio` + its stylesheet; these tests
 * open the real editor, evaluate jq through the real wasm runtime, prove the
 * primitives-injection seam, and prove the theme contract.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('default JqField', () => {
  test('evaluates jq through the real wasm runtime and rounds the result back to the field', async ({
    page,
  }) => {
    // Role-scoped: the door button's accessible name also carries the field label.
    const field = page.locator('#default').getByRole('textbox', { name: 'Transform' });
    await expect(field).toHaveValue('.value + 1');

    // Open the visual editor.
    await page.locator('#default').getByRole('button', { name: 'Visual editor' }).click();
    const editor = page.getByRole('dialog', { name: /Transform — Editor/ });
    await expect(editor).toBeVisible();
    // The canvas drew the loaded expression.
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // Run the expression against sample input through the real jq engine.
    await editor.getByRole('button', { name: 'Test', exact: true }).click();
    const testDialog = page.getByRole('dialog', { name: /Test Expression/ });
    await expect(testDialog).toBeVisible();
    await testDialog.locator('textarea').fill('{"value": 41}');
    await testDialog.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(testDialog.locator('.jqs-jq-output--ok')).toContainText('42');

    // Close the Test dialog, then save — the expression rounds back to the field.
    await page.keyboard.press('Escape');
    await expect(testDialog).toBeHidden();
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor).toBeHidden();

    const roundTripped = await page.locator('[data-testid="default-value"]').textContent();
    expect(roundTripped).toContain('.value');
    expect(roundTripped).toContain('1');
    await expect(field).toHaveValue(/\.value/);
  });

  test('builds on the graph from the palette', async ({ page }) => {
    await page.locator('#default').getByRole('button', { name: 'Visual editor' }).click();
    const editor = page.getByRole('dialog', { name: /Transform — Editor/ });
    await expect(editor).toBeVisible();

    const nodes = page.locator('.react-flow__node');
    const before = await nodes.count();
    await page.locator('.jqs-jq-palette__item', { hasText: 'Value' }).first().click();
    await expect(nodes).toHaveCount(before + 1);
  });
});

test.describe('declared variables', () => {
  test('draws a `$variable` root, lists it in the legend, and binds its sample on Run', async ({
    page,
  }) => {
    const field = page.locator('#variables').getByRole('textbox', { name: 'Route' });
    await expect(field).toHaveValue('$account.tier');

    // Open the editor: the expression reads `$account` as a path root, so it must
    // draw a graph rather than fall back to text.
    await page.locator('#variables').getByRole('button', { name: 'Visual editor' }).click();
    const editor = page.getByRole('dialog', { name: /Route — Editor/ });
    await expect(editor).toBeVisible();
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // The legend names the declared variable beside `.`.
    await editor.getByRole('button', { name: 'Legend' }).click();
    const legend = page.getByRole('dialog', { name: 'Legend' });
    await expect(legend).toBeVisible();
    await expect(legend.getByText('$account')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(legend).toBeHidden();

    // Drive the REAL path-root menu the PathSelector unit test stands in for:
    // select the `$account.tier` Value node and open its root menu. Options are
    // chosen by keyboard — the Radix popper can sit outside the small test
    // viewport, but Radix selects on keydown regardless of scroll position.
    await page.locator('.react-flow__node').filter({ hasText: 'Value' }).first().click();
    const rootSelect = editor.getByRole('combobox', { name: 'Path root' });
    await expect(rootSelect).toBeVisible();
    const pathPreview = editor.locator('.jqs-jq-path__preview');

    // Re-root to `.` so picking `$account` below genuinely drives a change through
    // the menu rather than re-selecting the value already in place. The `$account`
    // root is highlighted on open, so the option above it is `.`.
    await rootSelect.click();
    await expect(page.locator('.jqp-select-content')).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(pathPreview).not.toContainText('$account');

    // Reopen: the declared variable sits under its own "Variables" group; picking
    // it (the option below `.`) roots the path back at `$account`.
    await rootSelect.click();
    const rootMenu = page.locator('.jqp-select-content');
    await expect(rootMenu).toBeVisible();
    await expect(rootMenu.getByText('Variables')).toBeVisible();
    await expect(rootMenu.getByRole('option', { name: '$account' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(pathPreview).toContainText('$account');

    // Run the expression: `.` carries only the data the user types, and `$account`
    // is bound from the declared sample.
    await editor.getByRole('button', { name: 'Test', exact: true }).click();
    const testDialog = page.getByRole('dialog', { name: /Test Expression/ });
    await expect(testDialog).toBeVisible();
    // The read-only Variables section names `$account` and shows the sample the
    // run binds, so the bound value is not conjured from nowhere.
    await expect(testDialog.getByText('Variables')).toBeVisible();
    await expect(testDialog.locator('.jqs-jq-test-var__name')).toHaveText('$account');
    await expect(testDialog.locator('.jqs-jq-test-var__sample')).toContainText('"tier": "gold"');
    await testDialog.locator('textarea').fill('{"id": "r-1"}');
    await testDialog.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(testDialog.locator('.jqs-jq-output--ok')).toContainText('gold');
  });
});

test('a host can inject its own Button and still drive the editor', async ({ page }) => {
  const hostButton = page.locator('#injected [data-testid="host-button"]');
  await expect(hostButton).toBeVisible();
  // The built-in primitive class is NOT used for the injected control.
  await expect(hostButton).not.toHaveClass(/jqp-btn/);

  await hostButton.click();
  await expect(page.getByRole('dialog', { name: /Injected — Editor/ })).toBeVisible();
});

test('the theme contract: overriding a --jq-* token takes effect', async ({ page }) => {
  const probe = page.locator('[data-testid="theme-probe"]');
  const before = await probe.evaluate((el) => getComputedStyle(el).color);
  await page.locator('[data-testid="apply-theme"]').click();
  await expect
    .poll(() => probe.evaluate((el) => getComputedStyle(el).color))
    .toBe('rgb(16, 185, 129)');
  expect(before).not.toBe('rgb(16, 185, 129)');
});

/**
 * The host scenario: the app stamps `data-theme` on `document.documentElement`
 * (as a host app typically does) while the editor is portalled to `document.body` (Radix
 * Dialog). The portalled `.jq-studio-root` carries no stamp of its own, so it
 * must inherit the ancestor's stamp rather than fall through to the OS. These
 * assert a canvas-side `--jq-*` token — read off the editor dialog, which IS the
 * portalled `.jq-studio-root` — resolves to the stamped side even when the OS
 * preference points the other way.
 */
test.describe('the theme contract: an ancestor data-theme governs the portalled canvas', () => {
  const editorRootBg = (page: import('@playwright/test').Page) =>
    page
      .getByRole('dialog', { name: /Transform — Editor/ })
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--jq-color-bg').trim());

  const openEditor = async (page: import('@playwright/test').Page) => {
    await page.locator('#default').getByRole('button', { name: 'Visual editor' }).click();
    await expect(page.getByRole('dialog', { name: /Transform — Editor/ })).toBeVisible();
  };

  test('light stamp wins over an OS dark preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await openEditor(page);
    // The canvas root resolves the LIGHT ground, not the OS-preferred dark one.
    expect(await editorRootBg(page)).toBe('#ffffff');
  });

  test('dark stamp wins over an OS light preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await openEditor(page);
    // The canvas root resolves the DARK ground, not the OS-preferred light one.
    expect(await editorRootBg(page)).toBe('#0c0e12');
  });
});
