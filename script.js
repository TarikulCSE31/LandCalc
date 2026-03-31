const shapeSelect = document.getElementById("shapeSelect");
const inputUnit = document.getElementById("inputUnit");
const shapeFields = document.getElementById("shapeFields");
const calcBtn = document.getElementById("calcBtn");
const resetBtn = document.getElementById("resetBtn");
const result = document.getElementById("result");

const DRAW_BOARD_WIDTH = 760;
const DRAW_BOARD_HEIGHT = 420;
const DRAW_PADDING = 20;
const DRAW_CLOSE_THRESHOLD = 12;
const DRAW_MIN_CELLS_X = 12;
const DRAW_MAX_CELLS_X = 220;
const DRAW_MIN_CELLS_Y = 8;
const DRAW_MAX_CELLS_Y = 140;
const DRAW_ZOOM_MIN = 0.5;
const DRAW_ZOOM_MAX = 3;
const DRAW_ZOOM_STEP = 0.25;

const drawConfig = {
  cellsX: 30,
  cellsY: 16,
  zoom: 1
};

const drawState = {
  points: [],
  closed: false,
  message: ""
};

const unitToFeet = {
  ft: 1,
  m: 3.280839895,
  yd: 3
};

const SQUARE_FEET_PER = {
  decimal: 435.6,
  katha: 720,
  bigha: 14400,
  shotok: 435.6,
  acre: 43560,
  hectare: 107639.104167,
  shotangsho: 435.6,
  chhatak: 45
};

function renderFields() {
  const shape = shapeSelect.value;
  let html = "";

  if (shape === "rectangle") {
    html = `
      <div class="shape-box grid two-col">
        <label>দৈর্ঘ্য <input type="number" id="length" min="0" step="any" placeholder="যেমন 120" /></label>
        <label>প্রস্থ <input type="number" id="width" min="0" step="any" placeholder="যেমন 80" /></label>
      </div>
    `;
  } else if (shape === "triangle") {
    html = `
      <div class="shape-box grid two-col">
        <label>ভিত্তি (Base) <input type="number" id="base" min="0" step="any" /></label>
        <label>উচ্চতা (Height) <input type="number" id="height" min="0" step="any" /></label>
      </div>
    `;
  } else if (shape === "trapezium") {
    html = `
      <div class="shape-box grid two-col">
        <label>উপরের বাহু (a) <input type="number" id="a" min="0" step="any" /></label>
        <label>নিচের বাহু (b) <input type="number" id="b" min="0" step="any" /></label>
        <label>উচ্চতা (h) <input type="number" id="h" min="0" step="any" /></label>
      </div>
    `;
  } else if (shape === "circle") {
    html = `
      <div class="shape-box grid two-col">
        <label>ব্যাসার্ধ (Radius) <input type="number" id="radius" min="0" step="any" /></label>
      </div>
    `;
  } else if (shape === "draw") {
    html = `
      <div class="shape-box">
        <div class="grid two-col">
          <label>
            প্রতি ঘর (Grid Cell) =
            <input type="number" id="drawCellUnit" min="0.01" step="any" value="1" />
          </label>
          <label>
            X-axis Grid Cells
            <input type="number" id="drawCellsX" min="${DRAW_MIN_CELLS_X}" max="${DRAW_MAX_CELLS_X}" step="1" value="${drawConfig.cellsX}" />
          </label>
          <label>
            Y-axis Grid Cells
            <input type="number" id="drawCellsY" min="${DRAW_MIN_CELLS_Y}" max="${DRAW_MAX_CELLS_Y}" step="1" value="${drawConfig.cellsY}" />
          </label>
          <div class="draw-meta">
            বোর্ডে পয়েন্ট ক্লিক করে বাউন্ডারি আঁকুন। প্রথম পয়েন্টের কাছে ক্লিক করলে পলিগন বন্ধ হবে।
          </div>
        </div>
        <div class="draw-tools">
          <button type="button" id="drawUndo" class="ghost">Undo Point</button>
          <button type="button" id="drawClose" class="ghost">Close Shape</button>
          <button type="button" id="drawClear" class="ghost">Clear Drawing</button>
          <button type="button" id="drawZoomOut" class="ghost" title="ছোট দেখুন">Zoom −</button>
          <button type="button" id="drawZoomIn" class="ghost" title="বড় দেখুন">Zoom +</button>
          <button type="button" id="drawZoomReset" class="ghost" title="১০০%">Zoom Reset</button>
          <span id="drawZoomLabel" class="draw-zoom-label">100%</span>
        </div>
        <div class="draw-board-wrap">
          <div id="drawBoardInner" class="draw-board-inner">
            <svg id="drawBoard" class="draw-board" aria-label="Land drawing board"></svg>
          </div>
        </div>
        <div id="drawInfo" class="draw-info">পয়েন্ট: 0 | Shape: Open</div>
      </div>
    `;
  } else {
    html = `
      <div class="shape-box">
        <label>কোঅর্ডিনেট দিন (x,y) প্রতিটি পয়েন্ট নতুন লাইনে
          <textarea id="points" placeholder="0,0&#10;120,0&#10;130,60&#10;50,95&#10;0,70"></textarea>
        </label>
        <p class="hint">কমপক্ষে 3টি পয়েন্ট দিন। পয়েন্টগুলো boundary order এ দিতে হবে (ঘড়ির কাঁটার দিকে বা উল্টো দিকে)।</p>
      </div>
    `;
  }

  shapeFields.innerHTML = html;

  if (shape === "draw") {
    initDrawTool();
  }
}

function getPositiveNumber(id, label) {
  const el = document.getElementById(id);
  const value = Number(el?.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} সঠিকভাবে দিন (0 এর বেশি)।`);
  }
  return value;
}

function toSqFeet(areaSqInputUnit, currentUnit) {
  const factor = unitToFeet[currentUnit];
  return areaSqInputUnit * factor * factor;
}

function parsePolygonPoints(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    throw new Error("Polygon এর জন্য কমপক্ষে 3টি পয়েন্ট প্রয়োজন।");
  }

  const points = lines.map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length !== 2) {
      throw new Error(`লাইন ${idx + 1} সঠিক ফরম্যাটে নেই। x,y আকারে দিন।`);
    }
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`লাইন ${idx + 1} এ সংখ্যা ভুল আছে।`);
    }
    return { x, y };
  });

  return points;
}

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function format(n, digits = 4) {
  return Number(n).toLocaleString("en-US", {
    maximumFractionDigits: digits
  });
}

function axisLabelValue(n) {
  return Number(n).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });
  return el;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toBoardCoords(event, svgEl) {
  const boardWidth = getBoardWidth();
  const boardHeight = getBoardHeight();
  const rect = svgEl.getBoundingClientRect();
  const ratioX = boardWidth / rect.width;
  const ratioY = boardHeight / rect.height;
  const x = (event.clientX - rect.left) * ratioX;
  const y = (event.clientY - rect.top) * ratioY;
  return { x, y };
}

function snapToGrid(point) {
  const boardWidth = getBoardWidth();
  const boardHeight = getBoardHeight();
  const gridStepX = getGridStepX();
  const gridStepY = getGridStepY();
  const snappedX =
    Math.round((point.x - DRAW_PADDING) / gridStepX) * gridStepX + DRAW_PADDING;
  const snappedY =
    Math.round((point.y - DRAW_PADDING) / gridStepY) * gridStepY + DRAW_PADDING;

  return {
    x: clamp(snappedX, DRAW_PADDING, boardWidth - DRAW_PADDING),
    y: clamp(snappedY, DRAW_PADDING, boardHeight - DRAW_PADDING)
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function setDrawMessage(message) {
  drawState.message = message;
  updateDrawInfo();
}

function updateDrawInfo() {
  const drawInfo = document.getElementById("drawInfo");
  if (!drawInfo) return;
  const status = drawState.closed ? "Closed" : "Open";
  const baseText = `পয়েন্ট: ${drawState.points.length} | Shape: ${status}`;
  drawInfo.textContent = drawState.message ? `${baseText} | ${drawState.message}` : baseText;
}

function applyDrawZoom() {
  drawConfig.zoom = clamp(drawConfig.zoom, DRAW_ZOOM_MIN, DRAW_ZOOM_MAX);
  const inner = document.getElementById("drawBoardInner");
  const svgEl = document.getElementById("drawBoard");
  const label = document.getElementById("drawZoomLabel");
  const z = drawConfig.zoom;
  if (inner && svgEl) {
    inner.style.width = `${DRAW_BOARD_WIDTH * z}px`;
    inner.style.height = `${DRAW_BOARD_HEIGHT * z}px`;
    svgEl.style.transform = `scale(${z})`;
    svgEl.style.transformOrigin = "0 0";
  }
  if (label) {
    label.textContent = `${Math.round(z * 100)}%`;
  }
}

function drawPathText(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function getDrawCellUnitSafe() {
  const cellInput = document.getElementById("drawCellUnit");
  const v = Number(cellInput?.value);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function boardXToUnit(x, cellUnit) {
  return ((x - DRAW_PADDING) / getGridStepX()) * cellUnit;
}

function boardYToUnit(y, cellUnit) {
  return ((getBoardHeight() - DRAW_PADDING - y) / getGridStepY()) * cellUnit;
}

function getBoardWidth() {
  return DRAW_BOARD_WIDTH;
}

function getBoardHeight() {
  return DRAW_BOARD_HEIGHT;
}

function getGridStepX() {
  return (getBoardWidth() - DRAW_PADDING * 2) / drawConfig.cellsX;
}

function getGridStepY() {
  return (getBoardHeight() - DRAW_PADDING * 2) / drawConfig.cellsY;
}

function readBoardSizeInputs() {
  const xInput = document.getElementById("drawCellsX");
  const yInput = document.getElementById("drawCellsY");
  const rawX = Number(xInput?.value);
  const rawY = Number(yInput?.value);
  const nextX = clamp(
    Number.isFinite(rawX) ? Math.round(rawX) : drawConfig.cellsX,
    DRAW_MIN_CELLS_X,
    DRAW_MAX_CELLS_X
  );
  const nextY = clamp(
    Number.isFinite(rawY) ? Math.round(rawY) : drawConfig.cellsY,
    DRAW_MIN_CELLS_Y,
    DRAW_MAX_CELLS_Y
  );

  drawConfig.cellsX = nextX;
  drawConfig.cellsY = nextY;

  if (xInput) xInput.value = String(nextX);
  if (yInput) yInput.value = String(nextY);

  drawState.points = drawState.points.map((point) => snapToGrid(point));
  if (drawState.points.length < 3) drawState.closed = false;
}

function renderDrawBoard() {
  const svgEl = document.getElementById("drawBoard");
  if (!svgEl) return;
  const boardWidth = getBoardWidth();
  const boardHeight = getBoardHeight();
  svgEl.setAttribute("viewBox", `0 0 ${boardWidth} ${boardHeight}`);
  svgEl.setAttribute("width", String(boardWidth));
  svgEl.setAttribute("height", String(boardHeight));
  svgEl.innerHTML = "";
  const cellUnit = getDrawCellUnitSafe();
  const unitName = inputUnit.value;
  const maxGridX = drawConfig.cellsX;
  const maxGridY = drawConfig.cellsY;
  const gridStepX = getGridStepX();
  const gridStepY = getGridStepY();
  const tickStepX = Math.max(1, Math.ceil(maxGridX / 10));
  const tickStepY = Math.max(1, Math.ceil(maxGridY / 8));
  const axisBottomY = boardHeight - DRAW_PADDING;
  const axisLeftX = DRAW_PADDING;

  const defs = createSvgEl("defs");
  const pattern = createSvgEl("pattern", {
    id: "drawGrid",
    width: gridStepX,
    height: gridStepY,
    patternUnits: "userSpaceOnUse"
  });
  pattern.appendChild(
    createSvgEl("path", {
      d: `M ${gridStepX} 0 L 0 0 0 ${gridStepY}`,
      fill: "none",
      stroke: "#d6e3d3",
      "stroke-width": "1"
    })
  );
  defs.appendChild(pattern);
  svgEl.appendChild(defs);

  svgEl.appendChild(
    createSvgEl("rect", {
      x: 0,
      y: 0,
      width: boardWidth,
      height: boardHeight,
      fill: "url(#drawGrid)"
    })
  );

  svgEl.appendChild(
    createSvgEl("line", {
      x1: axisLeftX,
      y1: axisBottomY,
      x2: boardWidth - DRAW_PADDING,
      y2: axisBottomY,
      stroke: "#58735a",
      "stroke-width": "1.6"
    })
  );

  svgEl.appendChild(
    createSvgEl("line", {
      x1: axisLeftX,
      y1: axisBottomY,
      x2: axisLeftX,
      y2: DRAW_PADDING,
      stroke: "#58735a",
      "stroke-width": "1.6"
    })
  );

  for (let i = 0; i <= maxGridX; i += tickStepX) {
    const x = DRAW_PADDING + i * gridStepX;
    svgEl.appendChild(
      createSvgEl("line", {
        x1: x,
        y1: axisBottomY,
        x2: x,
        y2: axisBottomY - 6,
        stroke: "#5f7861",
        "stroke-width": "1"
      })
    );

    svgEl.appendChild(
      createSvgEl("text", {
        x,
        y: axisBottomY + 14,
        fill: "#4d634f",
        "font-size": "10",
        "text-anchor": "middle"
      })
    ).textContent = axisLabelValue(boardXToUnit(x, cellUnit));
  }

  for (let i = 0; i <= maxGridY; i += tickStepY) {
    const y = axisBottomY - i * gridStepY;
    svgEl.appendChild(
      createSvgEl("line", {
        x1: axisLeftX,
        y1: y,
        x2: axisLeftX + 6,
        y2: y,
        stroke: "#5f7861",
        "stroke-width": "1"
      })
    );

    svgEl.appendChild(
      createSvgEl("text", {
        x: axisLeftX - 6,
        y: y + 3,
        fill: "#4d634f",
        "font-size": "10",
        "text-anchor": "end"
      })
    ).textContent = axisLabelValue(boardYToUnit(y, cellUnit));
  }

  svgEl.appendChild(
    createSvgEl("text", {
      x: boardWidth - DRAW_PADDING,
      y: axisBottomY + 18,
      fill: "#3f5440",
      "font-size": "11",
      "text-anchor": "end",
      "font-weight": "600"
    })
  ).textContent = `X (${unitName})`;

  svgEl.appendChild(
    createSvgEl("text", {
      x: axisLeftX - 10,
      y: DRAW_PADDING - 4,
      fill: "#3f5440",
      "font-size": "11",
      "text-anchor": "end",
      "font-weight": "600"
    })
  ).textContent = `Y (${unitName})`;

  if (drawState.points.length > 1) {
    if (drawState.closed) {
      svgEl.appendChild(
        createSvgEl("polygon", {
          points: drawPathText(drawState.points),
          fill: "rgba(47, 125, 50, 0.22)",
          stroke: "#2f7d32",
          "stroke-width": String(2.3 / drawConfig.zoom)
        })
      );
    } else {
      svgEl.appendChild(
        createSvgEl("polyline", {
          points: drawPathText(drawState.points),
          fill: "none",
          stroke: "#2f7d32",
          "stroke-width": String(2.3 / drawConfig.zoom)
        })
      );
    }
  }

  drawState.points.forEach((point, idx) => {
    svgEl.appendChild(
      createSvgEl("circle", {
        cx: point.x,
        cy: point.y,
        r: idx === 0 ? 5.2 : 4.2,
        fill: idx === 0 ? "#215c24" : "#3f9743",
        stroke: "#ffffff",
        "stroke-width": String(1.2 / drawConfig.zoom)
      })
    );

    svgEl.appendChild(
      createSvgEl("text", {
        x: point.x + 7,
        y: point.y - 7,
        fill: "#2a462d",
        "font-size": "12",
        "font-weight": "600"
      })
    ).textContent = String(idx + 1);
  });

  updateDrawInfo();
  applyDrawZoom();
}

function addDrawPoint(event) {
  const svgEl = document.getElementById("drawBoard");
  if (!svgEl || drawState.closed) return;

  const point = snapToGrid(toBoardCoords(event, svgEl));

  if (drawState.points.length > 0) {
    const last = drawState.points[drawState.points.length - 1];
    if (distance(last, point) < 1) return;
  }

  if (
    drawState.points.length >= 3 &&
    distance(drawState.points[0], point) <= DRAW_CLOSE_THRESHOLD
  ) {
    drawState.closed = true;
    setDrawMessage("Shape closed");
    renderDrawBoard();
    return;
  }

  drawState.points.push(point);
  drawState.message = "";
  renderDrawBoard();
}

function initDrawTool() {
  drawState.points = [];
  drawState.closed = false;
  drawState.message = "";

  const svgEl = document.getElementById("drawBoard");
  const undoBtn = document.getElementById("drawUndo");
  const closeBtn = document.getElementById("drawClose");
  const clearBtn = document.getElementById("drawClear");
  const drawCellUnitInput = document.getElementById("drawCellUnit");
  const drawCellsXInput = document.getElementById("drawCellsX");
  const drawCellsYInput = document.getElementById("drawCellsY");
  const zoomInBtn = document.getElementById("drawZoomIn");
  const zoomOutBtn = document.getElementById("drawZoomOut");
  const zoomResetBtn = document.getElementById("drawZoomReset");

  if (!svgEl || !undoBtn || !closeBtn || !clearBtn) return;

  svgEl.addEventListener("click", addDrawPoint);

  undoBtn.addEventListener("click", () => {
    if (drawState.points.length === 0) return;
    drawState.points.pop();
    drawState.closed = false;
    drawState.message = "";
    renderDrawBoard();
  });

  closeBtn.addEventListener("click", () => {
    if (drawState.points.length < 3) {
      setDrawMessage("Close করতে 3+ পয়েন্ট দরকার");
      return;
    }
    drawState.closed = true;
    setDrawMessage("Shape closed");
    renderDrawBoard();
  });

  clearBtn.addEventListener("click", () => {
    drawState.points = [];
    drawState.closed = false;
    drawState.message = "";
    renderDrawBoard();
  });

  if (drawCellUnitInput) {
    drawCellUnitInput.addEventListener("input", renderDrawBoard);
  }
  if (drawCellsXInput) {
    drawCellsXInput.addEventListener("input", () => {
      readBoardSizeInputs();
      renderDrawBoard();
    });
  }
  if (drawCellsYInput) {
    drawCellsYInput.addEventListener("input", () => {
      readBoardSizeInputs();
      renderDrawBoard();
    });
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      drawConfig.zoom += DRAW_ZOOM_STEP;
      renderDrawBoard();
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      drawConfig.zoom -= DRAW_ZOOM_STEP;
      renderDrawBoard();
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      drawConfig.zoom = 1;
      renderDrawBoard();
    });
  }

  readBoardSizeInputs();
  renderDrawBoard();
}

function drawPointsToUnitPoints(points, cellUnit) {
  return points.map((point) => ({
    x: boardXToUnit(point.x, cellUnit),
    y: boardYToUnit(point.y, cellUnit)
  }));
}

function areaBreakdown(areaSqFt) {
  const decimal = areaSqFt / SQUARE_FEET_PER.decimal;
  const katha = areaSqFt / SQUARE_FEET_PER.katha;
  const bigha = areaSqFt / SQUARE_FEET_PER.bigha;
  const acre = areaSqFt / SQUARE_FEET_PER.acre;
  const hectare = areaSqFt / SQUARE_FEET_PER.hectare;
  const chhatak = areaSqFt / SQUARE_FEET_PER.chhatak;
  const sqMeter = areaSqFt * 0.09290304;

  return {
    decimal,
    katha,
    bigha,
    acre,
    hectare,
    chhatak,
    sqMeter
  };
}

function calculate() {
  try {
    const shape = shapeSelect.value;
    const unit = inputUnit.value;
    let areaInSquareInputUnit = 0;
    let shapeInfo = "";

    if (shape === "rectangle") {
      const length = getPositiveNumber("length", "দৈর্ঘ্য");
      const width = getPositiveNumber("width", "প্রস্থ");
      areaInSquareInputUnit = length * width;
    } else if (shape === "triangle") {
      const base = getPositiveNumber("base", "ভিত্তি");
      const height = getPositiveNumber("height", "উচ্চতা");
      areaInSquareInputUnit = 0.5 * base * height;
    } else if (shape === "trapezium") {
      const a = getPositiveNumber("a", "উপরের বাহু");
      const b = getPositiveNumber("b", "নিচের বাহু");
      const h = getPositiveNumber("h", "উচ্চতা");
      areaInSquareInputUnit = ((a + b) * h) / 2;
    } else if (shape === "circle") {
      const radius = getPositiveNumber("radius", "ব্যাসার্ধ");
      areaInSquareInputUnit = Math.PI * radius * radius;
    } else if (shape === "draw") {
      if (drawState.points.length < 3) {
        throw new Error("Draw Tool এ কমপক্ষে 3টি পয়েন্ট দিন।");
      }
      const drawCellUnit = getPositiveNumber("drawCellUnit", "প্রতি ঘর");
      const unitPoints = drawPointsToUnitPoints(drawState.points, drawCellUnit);
      areaInSquareInputUnit = polygonArea(unitPoints);
      const closedState = drawState.closed ? "Closed" : "Auto-closed";
      shapeInfo = `ড্রয়িং পয়েন্ট: ${drawState.points.length}, Status: ${closedState}`;
    } else {
      const pointsRaw = document.getElementById("points")?.value || "";
      const points = parsePolygonPoints(pointsRaw);
      areaInSquareInputUnit = polygonArea(points);
      if (areaInSquareInputUnit <= 0) {
        throw new Error("Polygon area শূন্য/ভুল এসেছে। পয়েন্ট order চেক করুন।");
      }
    }

    const areaSqFt = toSqFeet(areaInSquareInputUnit, unit);
    const b = areaBreakdown(areaSqFt);

    result.classList.remove("empty");
    result.innerHTML = `
      <div class="area-main">মোট জমি: ${format(areaSqFt)} sq ft</div>
      ${shapeInfo ? `<div class="small">${shapeInfo}</div>` : ""}
      <ul>
        <li>বর্গমিটার: ${format(b.sqMeter)} m²</li>
        <li>শতাংশ/ডেসিমেল: ${format(b.decimal)}</li>
        <li>কাঠা: ${format(b.katha)}</li>
        <li>বিঘা: ${format(b.bigha)}</li>
        <li>ছটাক: ${format(b.chhatak)}</li>
        <li>একর: ${format(b.acre)}</li>
        <li>হেক্টর: ${format(b.hectare)}</li>
      </ul>
    `;
  } catch (err) {
    result.classList.remove("empty");
    result.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function resetAll() {
  renderFields();
  result.className = "result empty";
  result.textContent = "এখনও হিসাব করা হয়নি";
}

shapeSelect.addEventListener("change", renderFields);
inputUnit.addEventListener("change", () => {
  if (shapeSelect.value === "draw" && document.getElementById("drawBoard")) {
    renderDrawBoard();
  }
});
calcBtn.addEventListener("click", calculate);
resetBtn.addEventListener("click", resetAll);

renderFields();
