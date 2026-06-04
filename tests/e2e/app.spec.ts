import { expect, test } from "@playwright/test";

test("home loads as dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Nhìn thấy Hà Nội")).toBeVisible();
  await expect(page.getByTestId("home-map-cta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở AI chat" })).toHaveCount(0);
  await expect(page.getByTestId("home-maplibre")).toHaveAttribute("data-maplibre-ready", "true");
  await page.evaluate(() => {
    const canvas = document.querySelector("[data-testid='home-maplibre'] canvas");
    canvas?.setAttribute("data-stability", "home-map");
  });
  await page.getByRole("button", { name: "Menu" }).click();
  await expect.poll(async () =>
    page.evaluate(() =>
      document.querySelector("[data-testid='home-maplibre'] canvas")?.getAttribute("data-stability"),
    ),
  ).toBe("home-map");
  await expect.poll(async () =>
    page.evaluate(() =>
      document.querySelector("[data-testid='home-maplibre'] canvas")?.getBoundingClientRect().height ?? 0,
    ),
  ).toBeGreaterThan(600);
});

test("map marker click opens panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Xem bản đồ" }).click();
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-maplibre-ready", "true");
  await page.mouse.move(720, 512);
  await expect(page.getByRole("button", { name: "Mạng lưới văn hóa" })).toHaveCount(0);
  await page.getByRole("button", { name: "Menu" }).hover();
  await expect(page.getByRole("button", { name: "Mạng lưới văn hóa" })).toBeVisible();
  await expect.poll(async () =>
    page.evaluate(() => document.querySelector(".maplibregl-canvas")?.getBoundingClientRect().height ?? 0),
  ).toBeGreaterThan(600);
  await page.evaluate(() => {
    const canvas = document.querySelector("[data-testid='map-canvas'] canvas");
    canvas?.setAttribute("data-stability", "map-view");
  });
  await page.getByTestId("map-marker-ho-guom").click();
  await expect(page.getByTestId("map-node-panel")).toContainText("Hồ Gươm");
  await expect.poll(async () =>
    page.evaluate(() =>
      document.querySelector("[data-testid='map-canvas'] canvas")?.getAttribute("data-stability"),
    ),
  ).toBe("map-view");
});

test("graph view opens no-node overview then supports node selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mạng lưới văn hóa" }).click();
  await expect(page.getByTestId("cytoscape-graph")).toBeVisible();
  await expect(page.getByTestId("cytoscape-graph")).toHaveAttribute("data-cytoscape-ready", "true");
  await expect.poll(async () =>
    page.evaluate(() => document.querySelector("[data-testid='cytoscape-graph']")?.getBoundingClientRect().height ?? 0),
  ).toBeGreaterThan(600);
  await expect(page.getByTestId("graph-overview-panel")).toContainText("Mạng Lưới Văn Hóa");
  await expect(page.getByTestId("graph-overview-panel")).toContainText("Khu Vực");
  await expect(page.getByTestId("tour-url-cta")).toHaveCount(0);
  await page.evaluate(() => {
    const graph = document.querySelector("[data-testid='cytoscape-graph']");
    graph?.setAttribute("data-stability", "graph-view");
  });

  await page.getByLabel("Tìm node").fill("Đền Bà Kiệu");
  await page.getByRole("button", { name: /Đền Bà Kiệu/ }).click();
  await expect(page.getByRole("heading", { name: "Đền Bà Kiệu" })).toBeVisible();
  await expect.poll(async () =>
    page.evaluate(() =>
      document.querySelector("[data-testid='cytoscape-graph']")?.getAttribute("data-stability"),
    ),
  ).toBe("graph-view");
  await expect(page.getByTestId("tour-url-cta")).toBeVisible();
  await page.getByRole("button", { name: "Quay lại graph overview" }).click();
  await expect(page.getByTestId("graph-overview-panel")).toBeVisible();
});

test("admin node sheet edits and adds rows", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByTestId("admin-sheet")).toBeVisible();
  await expect(page.getByTestId("admin-node-sheet")).toBeVisible();

  const firstTitleCell = page.getByTestId("admin-node-sheet").locator("tbody tr").first().locator("input").first();
  await firstTitleCell.fill("Node Sheet Test");
  await firstTitleCell.blur();
  await expect(firstTitleCell).toHaveValue("Node Sheet Test");

  await page.getByTestId("admin-add-row").click();
  await expect.poll(async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLInputElement>("[data-testid='admin-node-sheet'] input"))
        .some((input) => input.value === "Node mới"),
    ),
  ).toBe(true);
});

test("event and tour panels use real MapLibre canvases", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sự kiện văn hóa" }).click();
  await expect(page.getByTestId("event-maplibre")).toHaveAttribute("data-maplibre-ready", "true");
  await expect.poll(async () =>
    page.evaluate(() =>
      document.querySelector("[data-testid='event-maplibre'] canvas")?.getBoundingClientRect().height ?? 0,
    ),
  ).toBeGreaterThan(600);

  await page.getByRole("button", { name: "Tour trải nghiệm" }).click();
  await expect(page.getByTestId("tour-maplibre")).toHaveAttribute("data-maplibre-ready", "true");
  await expect.poll(async () =>
    page.evaluate(() =>
      document.querySelector("[data-testid='tour-maplibre'] canvas")?.getBoundingClientRect().height ?? 0,
    ),
  ).toBeGreaterThan(600);
});

test("admin tour sheet edits and adds rows", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Tour" }).click();
  await expect(page.getByTestId("admin-tour-sheet")).toBeVisible();

  const firstTitleCell = page.getByTestId("admin-tour-sheet").locator("tbody tr").first().locator("input").first();
  await firstTitleCell.fill("Tour Sheet Test");
  await firstTitleCell.blur();
  await expect(firstTitleCell).toHaveValue("Tour Sheet Test");

  await page.getByTestId("admin-add-row").click();
  await expect.poll(async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLInputElement>("[data-testid='admin-tour-sheet'] input"))
        .some((input) => input.value === "Tour mới"),
    ),
  ).toBe(true);
});

test("tour route renders on map", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tour trải nghiệm" }).click();
  await page.getByTestId("tour-row").first().click();
  await expect(page.getByText("Khởi đầu")).toBeVisible();
  await expect(page.getByText("Kết thúc")).toBeVisible();
});
