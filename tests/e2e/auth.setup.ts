import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE_PATH } from "../../playwright.config";
import fs from "fs";
import path from "path";

setup("authenticate user and save storage state", async ({ page }) => {
  setup.setTimeout(60000);
  const authDir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Gunakan storage state yang sudah ada jika valid
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    try {
      const stateContent = fs.readFileSync(STORAGE_STATE_PATH, "utf-8");
      if (stateContent.includes("finiq_session")) {
        return;
      }
    } catch {
      // Login ulang jika terjadi kegagalan baca file
    }
  }

  await page.goto("/login");

  // Isi email dan password akun demo owner
  const emailInput = page.locator("input[type='email']");
  await expect(emailInput).toBeVisible({ timeout: 15000 });
  await emailInput.fill("owner@finiq.app");

  const passwordInput = page.locator("input[type='password']");
  await passwordInput.fill("123456");

  // Submit form login
  const submitButton = page.locator("button[type='submit']").first();
  await submitButton.click();

  // Tunggu redirect ke /overview
  await page.waitForURL("**/overview", { timeout: 30000 });
  await expect(page).toHaveURL(/.*overview.*/);

  // Set localStorage agar modal selamat datang tidak menginterupsi interaksi pengujian
  await page.evaluate(() => {
    localStorage.setItem("finiq_tour_welcomed", "true");
    localStorage.setItem("finiq_tour_completed", "true");
  });

  // Simpan cookie sesi ke file storageState
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
