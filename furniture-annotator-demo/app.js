const floorplanSvg = (icons) => `
<svg xmlns="http://www.w3.org/2000/svg" width="992" height="992" viewBox="0 0 992 992">
  <defs>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fff7ea"/>
      <stop offset="100%" stop-color="#f1e4d7"/>
    </linearGradient>
  </defs>
  <rect width="992" height="992" fill="url(#paper)" />
  <rect x="30" y="30" width="932" height="932" rx="20" fill="#fffaf3" stroke="#cbb8a6" stroke-width="4" />
</svg>
`;

const baseSize = { w: 992, h: 992 };

const furniture = [
  {
    id: "f1",
    type: "sofa",
    name: "三人位布艺沙发",
    polygon: [
      [480, 310],
      [720, 310],
      [730, 330],
      [730, 380],
      [470, 380]
    ]
  },
  {
    id: "f2",
    type: "table",
    name: "客厅茶几",
    polygon: [
      [580, 410],
      [690, 410],
      [700, 430],
      [700, 465],
      [570, 465]
    ]
  },
  {
    id: "f3",
    type: "chair",
    name: "餐椅 A",
    polygon: [
      [305, 310],
      [335, 310],
      [335, 345],
      [305, 345]
    ]
  },
  {
    id: "f4",
    type: "chair",
    name: "餐椅 B",
    polygon: [
      [425, 310],
      [455, 310],
      [455, 345],
      [425, 345]
    ]
  },
  {
    id: "f5",
    type: "bed",
    name: "单人床",
    polygon: [
      [360, 610],
      [560, 610],
      [570, 635],
      [570, 690],
      [360, 690]
    ]
  },
  {
    id: "f6",
    type: "table",
    name: "书桌",
    polygon: [
      [540, 710],
      [700, 710],
      [705, 730],
      [705, 750],
      [540, 750]
    ]
  },
  {
    id: "f7",
    type: "chair",
    name: "书椅",
    polygon: [
      [575, 750],
      [615, 750],
      [615, 785],
      [575, 785]
    ]
  },
  {
    id: "f8",
    type: "table",
    name: "电视柜",
    polygon: [
      [760, 300],
      [900, 300],
      [900, 330],
      [760, 330]
    ]
  },
  {
    id: "f9",
    type: "table",
    name: "餐桌",
    polygon: [
      [330, 290],
      [430, 290],
      [445, 320],
      [445, 370],
      [430, 380],
      [330, 380],
      [315, 360],
      [315, 320]
    ]
  }
];

// Convert initial absolute coordinates (based on baseSize) into normalized 0-1 space.
const normalizedFurniture = furniture.map((item) => ({
  ...item,
  polygon: item.polygon.map((p) => [p[0] / baseSize.w, p[1] / baseSize.h])
}));

const candidatesByType = {
  sofa: [
    { id: "s1", label: "北欧三人位沙发" },
    { id: "s2", label: "深灰皮质 L 型沙发" },
    { id: "s3", label: "日式低矮布艺沙发" }
  ],
  bed: [
    { id: "b1", label: "1.8m 悬浮床" },
    { id: "b2", label: "1.5m 箱体床" },
    { id: "b3", label: "实木框架床" }
  ],
  table: [
    { id: "t1", label: "长方形餐桌" },
    { id: "t2", label: "可伸缩圆桌" },
    { id: "t3", label: "岩板餐桌" }
  ],
  chair: [
    { id: "c1", label: "软包餐椅" },
    { id: "c2", label: "藤编餐椅" },
    { id: "c3", label: "弧形靠背椅" }
  ]
};

const overlay = document.getElementById("overlay");
const popup = document.getElementById("popup");
const popupType = document.getElementById("popup-type");
const popupList = document.getElementById("popup-list");
const selectionInfo = document.getElementById("selectionInfo");
const floorplan = document.getElementById("floorplan");
const imageWrap = document.getElementById("imageWrap");
const modeButtons = document.querySelectorAll(".mode-btn");
const autoMode = document.getElementById("autoMode");
const autoType = document.getElementById("autoType");
const autoName = document.getElementById("autoName");
const autoTolerance = document.getElementById("autoTolerance");

const externalImagePath = "assets/floorplan.jpg";

const furnitureIcons = createFurnitureIcons();
const floorplanSvgData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(floorplanSvg(furnitureIcons))}`;
const rasterFloorplan = createRasterFloorplan();

let imageData = null;
let imageSize = { w: baseSize.w, h: baseSize.h };

setMode("raster");

let activeId = null;

function renderFurniture() {
  overlay.innerHTML = "";

  normalizedFurniture.forEach((item) => {
    const shapeEl = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const points = item.polygon
      .map((p) => [p[0] * imageSize.w, p[1] * imageSize.h].join(","))
      .join(" ");
    shapeEl.setAttribute("points", points);

    shapeEl.classList.add("furniture");
    shapeEl.dataset.id = item.id;
    shapeEl.dataset.type = item.type;
    if (item.id === activeId) shapeEl.classList.add("active");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.classList.add("label");
    const anchor = item.polygon[0];
    label.setAttribute("x", anchor[0] * imageSize.w + 4);
    label.setAttribute("y", anchor[1] * imageSize.h - 6);
    label.textContent = item.name;

    overlay.appendChild(shapeEl);
    overlay.appendChild(label);
  });
}

function setActive(id) {
  activeId = id;
  renderFurniture();
}

function openPopup(item, targetEl) {
  const list = candidatesByType[item.type] || [];
  popupType.textContent = `类型：${item.type}`;
  popupList.innerHTML = "";

  list.forEach((option) => {
    const row = document.createElement("div");
    row.className = "popup-item";
    row.textContent = option.label;
    row.addEventListener("click", () => {
      item.name = option.label;
      selectionInfo.innerHTML = `已选择：<strong>${option.label}</strong><br/>家具类型：${item.type}`;
      closePopup();
      renderFurniture();
    });
    popupList.appendChild(row);
  });

  const wrapRect = imageWrap.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const left = targetRect.left - wrapRect.left + targetRect.width + 8;
  const top = targetRect.top - wrapRect.top;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
}

function closePopup() {
  popup.classList.remove("open");
  popup.setAttribute("aria-hidden", "true");
}

function setMode(mode) {
  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  if (mode === "raster") {
    floorplan.src = externalImagePath;
  } else {
    floorplan.src = floorplanSvgData;
  }
}

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

floorplan.addEventListener("load", () => {
  const naturalW = floorplan.naturalWidth || baseSize.w;
  const naturalH = floorplan.naturalHeight || baseSize.h;
  imageSize = { w: naturalW, h: naturalH };
  overlay.setAttribute("viewBox", `0 0 ${naturalW} ${naturalH}`);
  imageData = readImageData(floorplan, naturalW, naturalH);
  renderFurniture();
});

floorplan.addEventListener("error", () => {
  floorplan.src = rasterFloorplan;
});

overlay.addEventListener("click", (event) => {
  const target = event.target.closest(".furniture");
  if (!target) return;
  const id = target.dataset.id;
  const item = normalizedFurniture.find((f) => f.id === id);
  if (!item) return;

  setActive(id);
  selectionInfo.innerHTML = `当前家具：<strong>${item.name}</strong><br/>类型：${item.type}`;
  openPopup(item, target);
});

imageWrap.addEventListener("click", (event) => {
  if (event.target.closest(".furniture") || event.target.closest("#popup")) return;
  if (autoMode.checked) {
    const rect = floorplan.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * imageSize.w);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * imageSize.h);
    if (x >= 0 && y >= 0 && x < imageSize.w && y < imageSize.h) {
      const polygon = autoTracePolygon(x, y, Number(autoTolerance.value || 35))
        .map((p) => [p[0] / imageSize.w, p[1] / imageSize.h]);
      if (polygon.length >= 3) {
        const id = `auto_${Date.now()}`;
        const type = autoType.value;
        const name = autoName.value.trim() || defaultNameForType(type);
        normalizedFurniture.push({ id, type: normalizeType(type), name, polygon });
        setActive(id);
        selectionInfo.innerHTML = `已自动生成：<strong>${name}</strong><br/>类型：${type}`;
        autoName.value = "";
        renderFurniture();
      }
    }
    return;
  }
  activeId = null;
  renderFurniture();
  closePopup();
  selectionInfo.textContent = "请选择一个家具";
});

renderFurniture();

function readImageData(img, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function autoTracePolygon(seedX, seedY, tolerance) {
  if (!imageData) return [];
  const { data, width, height } = imageData;
  const idx = (seedY * width + seedX) * 4;
  const seed = [data[idx], data[idx + 1], data[idx + 2]];
  const mask = new Uint8Array(width * height);
  const stack = [[seedX, seedY]];
  const dist = (r, g, b) =>
    Math.abs(r - seed[0]) + Math.abs(g - seed[1]) + Math.abs(b - seed[2]);

  while (stack.length) {
    const [x, y] = stack.pop();
    const i = y * width + x;
    if (mask[i]) continue;
    const p = i * 4;
    const d = dist(data[p], data[p + 1], data[p + 2]);
    if (d > tolerance) continue;
    mask[i] = 1;
    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }

  const boundary = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      if (
        !mask[i - 1] ||
        !mask[i + 1] ||
        !mask[i - width] ||
        !mask[i + width]
      ) {
        boundary.push([x, y]);
      }
    }
  }

  if (boundary.length < 3) return [];
  const hull = convexHull(boundary);
  return simplifyPolygon(hull, 2);
}

function convexHull(points) {
  const pts = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function simplifyPolygon(points, epsilon) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  function rdp(start, end) {
    let maxDist = 0;
    let idx = -1;
    const [x1, y1] = points[start];
    const [x2, y2] = points[end];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    for (let i = start + 1; i < end; i++) {
      const [x0, y0] = points[i];
      const t = len2 === 0 ? 0 : ((x0 - x1) * dx + (y0 - y1) * dy) / len2;
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const dist = Math.hypot(x0 - px, y0 - py);
      if (dist > maxDist) {
        maxDist = dist;
        idx = i;
      }
    }
    if (maxDist > epsilon && idx !== -1) {
      keep[idx] = true;
      rdp(start, idx);
      rdp(idx, end);
    }
  }

  rdp(0, points.length - 1);
  return points.filter((_, i) => keep[i]);
}

function defaultNameForType(type) {
  switch (type) {
    case "sofa":
      return "沙发";
    case "bed":
      return "单人床";
    case "table":
      return "桌";
    case "chair":
      return "椅";
    case "desk":
      return "书桌";
    case "tv":
      return "电视柜";
    default:
      return "家具";
  }
}

function normalizeType(type) {
  if (type === "desk" || type === "tv") return "table";
  return type;
}

function createFurnitureIcons() {
  return {
    sofa: createIcon((ctx) => {
      ctx.fillStyle = "#e67d4b";
      ctx.fillRect(4, 20, 92, 24);
      ctx.fillRect(12, 8, 76, 16);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(16, 14, 28, 10);
    }),
    bed: createIcon((ctx) => {
      ctx.fillStyle = "#5b7cba";
      ctx.fillRect(6, 18, 88, 26);
      ctx.fillStyle = "#7f98cc";
      ctx.fillRect(10, 8, 36, 12);
      ctx.fillRect(54, 8, 36, 12);
      ctx.strokeStyle = "#3e5c92";
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 18, 88, 26);
    }),
    table: createIcon((ctx) => {
      ctx.fillStyle = "#c49a3a";
      ctx.beginPath();
      ctx.ellipse(50, 28, 28, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#9b7527";
      ctx.lineWidth = 2;
      ctx.stroke();
    }),
    chair: createIcon((ctx) => {
      ctx.fillStyle = "#6c9a8b";
      ctx.fillRect(28, 18, 44, 20);
      ctx.fillRect(32, 8, 36, 10);
    })
  };
}

function createIcon(drawFn) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawFn(ctx);
  return {
    data: canvas.toDataURL("image/png"),
    draw: drawFn
  };
}

function createRasterFloorplan() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 800, 450);
  grad.addColorStop(0, "#fff7ea");
  grad.addColorStop(1, "#efe2d4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 450);

  ctx.fillStyle = "#fffaf3";
  ctx.strokeStyle = "#cbb8a6";
  ctx.lineWidth = 4;
  roundRect(ctx, 30, 30, 740, 390, 20);
  ctx.fill();
  ctx.stroke();

  const rooms = [
    [50, 60, 320, 170],
    [380, 60, 350, 170],
    [50, 245, 260, 155],
    [320, 245, 410, 155]
  ];
  ctx.fillStyle = "#fff5e8";
  ctx.strokeStyle = "#d6c2b0";
  ctx.lineWidth = 3;
  rooms.forEach(([x, y, w, h]) => {
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();
  });

  ctx.fillStyle = "#8a7a6f";
  ctx.font = "14px 'Noto Serif SC', serif";
  ctx.fillText("客厅", 80, 90);
  ctx.fillText("主卧", 410, 90);
  ctx.fillText("餐厨", 80, 275);
  ctx.fillText("次卧", 350, 275);

  drawIcon(ctx, furnitureIcons.sofa, 110, 120, 150, 70);
  drawIcon(ctx, furnitureIcons.table, 130, 300, 90, 90);
  drawIcon(ctx, furnitureIcons.chair, 70, 285, 48, 48);
  drawIcon(ctx, furnitureIcons.chair, 226, 285, 48, 48);
  drawIcon(ctx, furnitureIcons.bed, 470, 110, 190, 90);
  drawIcon(ctx, furnitureIcons.bed, 395, 295, 150, 75);

  return canvas.toDataURL("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawIcon(ctx, icon, x, y, w, h) {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d");
  offCtx.scale(w / 100, h / 60);
  icon.draw(offCtx);
  ctx.drawImage(off, x, y);
}
