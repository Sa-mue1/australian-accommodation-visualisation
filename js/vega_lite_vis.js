const embedOptions = {
  actions: true,
  renderer: "svg",
  config: {
    font: "Arial",
    title: {
      font: "Georgia",
      subtitleFont: "Arial"
    },
    header: {
      labelFont: "Georgia",
      titleFont: "Georgia"
    },
    axis: {
      labelFont: "Arial",
      titleFont: "Arial"
    },
    legend: {
      labelFont: "Arial",
      titleFont: "Arial"
    },
    text: {
      font: "Arial"
    }
  }
};

const roleColours = {
  flowGrowth: "#00736B",
  flowFill: "#EFF7F5",
  flowBorder: "#A8CBC5",
  year2025: "#80658F",
  priceLow: "#E8BB82",
  priceMiddle: "#BB7330",
  priceHigh: "#74300B"
};

document.documentElement.style.setProperty(
  "--flow-growth",
  roleColours.flowGrowth
);

document.documentElement.style.setProperty(
  "--flow-annotation-fill",
  roleColours.flowFill
);

document.documentElement.style.setProperty(
  "--flow-annotation-border",
  roleColours.flowBorder
);

function themeColour(name, fallback) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
}

const chartPalette = {
  hotel: themeColour("--category-hotel", "#0055FF"),
  hotelTint: themeColour("--hotel-annotation-fill", "#EDF4FF"),
  sydney: themeColour("--city-sydney", "#173B69"),
  sydneyTint: themeColour("--city-sydney-tint", "#EEF3F9"),
  melbourne: themeColour("--city-melbourne", "#8C6D00"),
  melbourneTint: themeColour("--city-melbourne-tint", "#FBF6DF"),
  flowGrowth: roleColours.flowGrowth,
  flowDecline: themeColour("--flow-decline", "#9E007E"),
  flowFill: roleColours.flowFill,
  flowBorder: roleColours.flowBorder,
  year2025: roleColours.year2025,
  year2026: themeColour("--international-current", "#6F2945"),
  rentalPrices: [
    roleColours.priceLow,
    roleColours.priceMiddle,
    roleColours.priceHigh
  ],
  occupancyText: themeColour("--occupancy-highlight", "#00677F"),
  occupancy: [
    themeColour("--occupancy-0", "#F0FBFF"),
    themeColour("--occupancy-25", "#C6EDF7"),
    themeColour("--occupancy-50", "#76D2E9"),
    themeColour("--occupancy-75", "#078CB5"),
    themeColour("--occupancy-100", "#003A4D")
  ]
};

function replaceChartColours(value, replacements) {
  if (typeof value === "string") {
    return value.replace(/#[0-9a-f]{6}\b/gi, colour =>
      replacements[colour.toUpperCase()] || colour
    );
  }

  if (Array.isArray(value)) {
    return value.map(item => replaceChartColours(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceChartColours(item, replacements)
      ])
    );
  }

  return value;
}

function applyChartTheme(id, specification) {
  const replacements = {};

  if ([
    "domestic-recovery",
    "domestic-accommodation-streamgraph",
    "state-accommodation-mosaic"
  ].includes(id)) {
    replacements["#3366A3"] = chartPalette.hotel;
    replacements["#EEF4FB"] = chartPalette.hotelTint;
  }

  if ([
    "hotel-destination-rankings",
    "short-term-rental-map",
    "short-term-rental-price-density"
  ].includes(id)) {
    replacements["#007C91"] = chartPalette.sydney;
    replacements["#C65D21"] = chartPalette.melbourne;
    replacements["#B4521A"] = chartPalette.melbourne;
    replacements["#EDF7F8"] = chartPalette.sydneyTint;
    replacements["#FCF2E9"] = chartPalette.melbourneTint;
  }

  if (id === "international-origin-flow") {
    replacements["#355E56"] = chartPalette.flowGrowth;
    replacements["#31594F"] = chartPalette.flowGrowth;
    replacements["#9B6A45"] = chartPalette.flowDecline;
    replacements["#F0F5F3"] = chartPalette.flowFill;
    replacements["#A8C0B8"] = chartPalette.flowBorder;
  }

  if (id === "accommodation-occupancy-radial") {
    ["#F0FCFF", "#C7EFFA", "#79D5F0", "#20A8D8", "#007EA8"]
      .forEach((colour, index) => {
        replacements[colour] = chartPalette.occupancy[index];
      });

    replacements["#006B8F"] = chartPalette.occupancyText;
  }

  if (id === "international-accommodation-change") {
    replacements["#AEB5BF"] = chartPalette.year2025;
    replacements["#626B77"] = chartPalette.year2025;
    replacements["#6F2945"] = chartPalette.year2026;
  }

  const themed = replaceChartColours(specification, replacements);

  if ([
    "international-state-map",
    "international-accommodation-change"
  ].includes(id)) {
    themed.title.subtitleColor = "#202124";
  }

  if (id === "short-term-rental-map") {
    themed.title.subtitle =
      "Circle size shows listings; copper shows median advertised prices.";

    for (const panel of themed.hconcat) {
      const circles = panel.layer.find(layer =>
        layer.encoding?.color?.field === "median_price"
      );

      if (!circles) continue;

      circles.encoding.color.title = "Median advertised price (AUD)";

      circles.encoding.color.scale = {
        domain: [100, 375, 650],
        range: chartPalette.rentalPrices,
        interpolate: "lab",
        clamp: true
      };

      const sizeLegend = circles.encoding.size.legend;

      sizeLegend.symbolFillColor = "white";
      sizeLegend.symbolStrokeColor = roleColours.priceHigh;
      sizeLegend.symbolStrokeWidth = 1.5;
    }
  }

  if (id === "international-accommodation-change") {
    const points = themed.layer.find(layer =>
      layer.mark?.type === "point" &&
      layer.encoding?.color?.field === "year_label"
    );

    if (points) {
      const legend = points.encoding.color.legend;

      delete points.encoding.color;
      delete points.mark.stroke;

      points.mark.strokeWidth = 2;

      points.encoding.fill = {
        field: "year_label",
        type: "nominal",
        title: "Year ending June",
        scale: {
          domain: ["2025", "2026"],
          range: ["white", chartPalette.year2026]
        },
        legend
      };

      points.encoding.stroke = {
        field: "year_label",
        type: "nominal",
        title: "Year ending June",
        scale: {
          domain: ["2025", "2026"],
          range: [chartPalette.year2025, chartPalette.year2026]
        },
        legend
      };

      legend.symbolStrokeWidth = 2;

      legend.labelExpr =
        "datum.label === '2025' ? '2025 (hollow)' : '2026 (filled)'";
    }
  }

  if (id === "hotel-destination-rankings") {
    const lines = themed.layer.find(
      layer => layer.mark?.type === "line"
    );

    if (lines) {
      lines.encoding.strokeDash = {
        field: "destination_group",
        type: "nominal",
        scale: {
          domain: [
            "Sydney",
            "Melbourne",
            "Brisbane",
            "Other destinations"
          ],
          range: [
            [1, 0],
            [7, 4],
            [2, 3],
            [1, 0]
          ]
        },
        legend: null
      };
    }
  }

  if (id === "short-term-rental-price-density") {
    themed.title.subtitle =
      "Up to $1,000: vertical dashes mark medians; dots mark peaks.";

    const lines = themed.spec.layer.find(
      layer => layer.mark?.type === "line"
    );

    if (lines) {
      lines.encoding.strokeDash = {
        field: "city",
        type: "nominal",
        scale: {
          domain: ["Sydney", "Melbourne"],
          range: [[1, 0], [7, 4]]
        },
        legend: null
      };
    }

    themed.spec.encoding.color.legend.symbolType = "stroke";
    themed.spec.encoding.color.legend.symbolStrokeWidth = 3;
    themed.spec.encoding.color.legend.symbolSize = 160;
  }

  if (id === "international-origin-flow") {
    const routes = themed.layer.find(layer =>
      layer.mark?.type === "line" &&
      layer.encoding?.color?.field === "change_direction"
    );

    if (routes) {
      routes.mark.opacity = 0.9;

      routes.encoding.strokeDash = {
        field: "change_direction",
        type: "nominal",
        scale: {
          domain: ["Growth", "Decline"],
          range: [[1, 0], [6, 4]]
        },
        legend: null
      };

      routes.encoding.color.legend.labelExpr =
        "datum.label === 'Decline' ? 'Decline (dashed)' : 'Growth (solid)'";
    }
  }

  return themed;
}

function createViewUpdater(view) {
  let pending = {};
  let needsResize = false;
  let scheduled = false;
  let running = false;

  async function flush() {
    scheduled = false;

    if (running) return;

    running = true;

    try {
      while (Object.keys(pending).length) {
        const values = pending;
        const resize = needsResize;

        pending = {};
        needsResize = false;

        if (resize) view.resize();

        await view.runAsync(null, current => {
          for (const [name, value] of Object.entries(values)) {
            current.signal(name, value);
          }
        });
      }
    } catch (error) {
      console.error("Chart update failed:", error);
    } finally {
      running = false;

      if (Object.keys(pending).length && !scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    }
  }

  return (values, resize = false) => {
    Object.assign(pending, values);
    needsResize = needsResize || resize;

    if (!scheduled && !running) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  };
}

function enableMapNavigation(view, container, options = {}) {
  const svg = container.querySelector("svg.marks");

  const frame = svg?.querySelector(
    options.frameSelector || "g.mark-group.role-frame.root"
  );

  if (!svg || !frame) return;

  const prefix = options.prefix || "map";
  const label = options.label || "Australian";
  const focusTarget = options.focusFrame ? frame : container;
  const controlsHost = options.controlsHost || container;
  const update = options.update || createViewUpdater(view);
  const widthSignal = options.widthSignal || "width";

  focusTarget.setAttribute("tabindex", "0");
  focusTarget.setAttribute("role", "region");

  focusTarget.setAttribute(
    "aria-label",
    `Interactive ${label} map. Drag to move. Scroll to zoom. Arrow keys move the view. Plus and minus zoom. Home resets.`
  );

  const toolbar = document.createElement("div");

  toolbar.className = "map-toolbar";

  toolbar.innerHTML = `
    <div class="map-controls" role="group" aria-label="${label} map navigation">
      <button
        type="button"
        data-map-action="out"
        aria-label="Zoom out of ${label}"
        title="Zoom out"
      >−</button>

      <output
        class="map-zoom-value"
        aria-label="${label} zoom level"
        aria-live="off"
      >100%</output>

      <button
        type="button"
        data-map-action="in"
        aria-label="Zoom into ${label}"
        title="Zoom in"
      >+</button>

      <button
        type="button"
        data-map-action="reset"
        class="map-reset"
        title="Reset ${label} map"
      >Reset</button>
    </div>
  `;

  if (options.showHelp !== false) {
    const help = document.createElement("p");

    help.className = "map-help";
    help.textContent = "Drag to move. Scroll to zoom.";

    toolbar.appendChild(help);
  }

  controlsHost.appendChild(toolbar);

  const zoomValue = toolbar.querySelector("output");
  const zoomIn = toolbar.querySelector('[data-map-action="in"]');
  const zoomOut = toolbar.querySelector('[data-map-action="out"]');

  let camera = {
    zoom: 1,
    x: 0,
    y: 0
  };

  let drag = null;

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const dimensions = () => ({
    width: Number(view.signal(widthSignal)),
    height: Number(view.signal("height"))
  });

  function plotPoint(event) {
    const matrix = frame.getScreenCTM();

    if (!matrix) return null;

    const point = svg.createSVGPoint();

    point.x = event.clientX;
    point.y = event.clientY;

    return point.matrixTransform(matrix.inverse());
  }

  function inside(point) {
    const { width, height } = dimensions();

    return point &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= width &&
      point.y <= height;
  }

  function moveCamera(next) {
    const { width, height } = dimensions();

    const zoom = clamp(next.zoom, 1, 6);
    const maxX = width * ((zoom - 1) / 2 + 0.35);
    const maxY = height * ((zoom - 1) / 2 + 0.35);

    camera = {
      zoom,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY)
    };

    update({
      [`${prefix}_zoom`]: camera.zoom,
      [`${prefix}_pan_x`]: camera.x,
      [`${prefix}_pan_y`]: camera.y
    });

    zoomValue.textContent = `${Math.round(zoom * 100)}%`;

    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 6;
  }

  function changeZoom(factor, point) {
    const { width, height } = dimensions();

    const nextZoom = clamp(camera.zoom * factor, 1, 6);

    if (nextZoom === camera.zoom) return;

    if (nextZoom === 1) {
      moveCamera({
        zoom: 1,
        x: 0,
        y: 0
      });

      return;
    }

    const anchor = point || {
      x: width / 2,
      y: height / 2
    };

    const ratio = nextZoom / camera.zoom;

    moveCamera({
      zoom: nextZoom,
      x: (anchor.x - width / 2) * (1 - ratio) + camera.x * ratio,
      y: (anchor.y - height / 2) * (1 - ratio) + camera.y * ratio
    });
  }

  toolbar.addEventListener("click", event => {
    const action = event.target.closest("button")?.dataset.mapAction;

    if (action === "in") changeZoom(1.35);
    if (action === "out") changeZoom(1 / 1.35);

    if (action === "reset") {
      moveCamera({
        zoom: 1,
        x: 0,
        y: 0
      });
    }
  });

  svg.addEventListener("wheel", event => {
    const point = plotPoint(event);

    if (!inside(point)) return;

    const multiplier =
      event.deltaMode === 1 ? 16 :
      event.deltaMode === 2 ? 300 :
      1;

    const factor = Math.exp(
      -clamp(event.deltaY * multiplier, -250, 250) * 0.002
    );

    if (clamp(camera.zoom * factor, 1, 6) === camera.zoom) return;

    event.preventDefault();

    changeZoom(factor, point);
  }, { passive: false });

  svg.addEventListener("pointerdown", event => {
    const point = plotPoint(event);

    if (event.button !== 0 || drag || !inside(point)) return;

    event.preventDefault();

    focusTarget.focus({
      preventScroll: true
    });

    drag = {
      id: event.pointerId,
      point,
      x: camera.x,
      y: camera.y
    };

    svg.setPointerCapture(event.pointerId);

    frame.classList.add("is-dragging");
  });

  svg.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;

    const point = plotPoint(event);

    if (!point) return;

    moveCamera({
      zoom: camera.zoom,
      x: drag.x + point.x - drag.point.x,
      y: drag.y + point.y - drag.point.y
    });
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;

    const pointerId = drag.id;

    drag = null;

    frame.classList.remove("is-dragging");

    if (svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
  }

  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("lostpointercapture", endDrag);

  focusTarget.addEventListener("keydown", event => {
    if (event.target.closest("button, summary, a, input")) return;

    const moves = {
      ArrowLeft: [40, 0],
      ArrowRight: [-40, 0],
      ArrowUp: [0, 40],
      ArrowDown: [0, -40]
    };

    if (moves[event.key]) {
      event.preventDefault();

      const [x, y] = moves[event.key];

      moveCamera({
        zoom: camera.zoom,
        x: camera.x + x,
        y: camera.y + y
      });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(1.35);
    } else if (event.key === "-") {
      event.preventDefault();
      changeZoom(1 / 1.35);
    } else if (event.key === "Home" || event.key === "0") {
      event.preventDefault();

      moveCamera({
        zoom: 1,
        x: 0,
        y: 0
      });
    }
  });

  zoomOut.disabled = true;
}

function enableRentalMaps(view, container) {
  container.style.paddingRight = "0px";

  const update = createViewUpdater(view);
  const navigation = document.createElement("div");

  navigation.className = "rental-navigation-grid";

  container.appendChild(navigation);

  const cities = [
    ["sydney", "Sydney"],
    ["melbourne", "Melbourne"]
  ];

  for (const [prefix, label] of cities) {
    const host = document.createElement("div");

    navigation.appendChild(host);

    enableMapNavigation(view, container, {
      prefix,
      label,
      frameSelector: `g.${prefix}_group > g`,
      widthSignal: "childWidth",
      focusFrame: true,
      controlsHost: host,
      showHelp: false,
      update
    });
  }

  const help = document.createElement("p");

  help.className = "rental-map-help";
  help.textContent =
    "Drag either map to move. Scroll or use buttons to zoom.";

  container.appendChild(help);

  let previousWidth = 0;

  function resizeMaps() {
    const width = Math.floor(
      (Math.max(420, container.clientWidth) - 26) / 2
    );

    if (width === previousWidth) return;

    previousWidth = width;

    update({
      childWidth: width
    }, true);
  }

  const observer = new ResizeObserver(resizeMaps);

  observer.observe(container);

  resizeMaps();
}

function enableRentalPriceSizing(view, container) {
  const update = createViewUpdater(view);
  let previousWidth = 0;

  function resizeChart() {
    const width = Math.floor(
      Math.max(420, container.clientWidth) - 12
    );

    if (width === previousWidth) return;

    previousWidth = width;

    update({
      child_width: width
    }, true);
  }

  const observer = new ResizeObserver(resizeChart);

  observer.observe(container);

  resizeChart();
}

function occupancyLayoutPatch(specification) {
  return {
    ...specification,
    layout: {
      ...specification.layout,
      columns: {
        signal: "occupancy_columns"
      }
    }
  };
}

function enableOccupancySizing(view, container) {
  const update = createViewUpdater(view);
  let previousSize = "";

  function resizeChart() {
    const available = Math.max(280, container.clientWidth);
    const columns = available >= 1000 ? 4 : available >= 580 ? 2 : 1;

    const width = Math.floor(
      (available - 12 - (columns - 1) * 20) / columns
    );

    const radius = Math.min(140, (width - 28) / 2);
    const size = `${columns}:${width}`;

    if (size === previousSize) return;

    previousSize = size;

    update({
      occupancy_columns: columns,
      child_width: width,
      child_height: radius * 2 + 78
    }, true);
  }

  const observer = new ResizeObserver(resizeChart);

  observer.observe(container);

  resizeChart();
}

function alignStoryWithPlot(container) {
  const card = container.closest(".chart-card");
  const story = card?.querySelector(".chart-story");
  const svg = container.querySelector("svg.marks");

  if (!card || !story || !svg) return;

  let pendingFrame = null;

  function align() {
    pendingFrame = null;

    const cells = svg.querySelectorAll(
      "g.cell > g > path.background"
    );

    const first = cells.length >= 2
      ? cells[0]
      : svg.querySelector("g.root > g > path.background");

    const last = cells.length >= 2 ? cells[1] : first;

    if (!first || !last) return;

    const bounds = container.getBoundingClientRect();
    const left = first.getBoundingClientRect();
    const right = last.getBoundingClientRect();

    card.style.setProperty(
      "--story-left",
      `${Math.max(0, left.left - bounds.left)}px`
    );

    card.style.setProperty(
      "--story-right",
      `${Math.max(0, bounds.right - right.right)}px`
    );

    card.style.setProperty(
      "--story-gap",
      cells.length >= 2
        ? `${Math.max(0, right.left - left.right)}px`
        : "28px"
    );
  }

  function schedule() {
    if (pendingFrame !== null) return;

    pendingFrame = requestAnimationFrame(align);
  }

  const observer = new ResizeObserver(schedule);

  observer.observe(container);
  observer.observe(svg);

  schedule();
}

const charts = [
  ["domestic-recovery", "domestic_recovery.vg.json"],
  ["domestic-quarters", "domestic_state_quarters.vg.json"],
  ["international-state-map", "international_state_recovery.vg.json"],
  ["short-term-rental-map", "short_term_rental_symbols.vg.json"],
  ["international-origin-flow", "international_origin_flow.vg.json"],
  ["international-accommodation-change", "international_accommodation_change.vg.json"],
  ["hotel-destination-rankings", "hotel_destination_rankings.vg.json"],
  ["short-term-rental-price-density", "short_term_rental_price_density.vg.json"],
  ["domestic-accommodation-streamgraph", "domestic_accommodation_streamgraph.vg.json"],
  ["state-accommodation-mosaic", "state_accommodation_mosaic.vg.json"],
  ["accommodation-occupancy-radial", "accommodation_occupancy_radial.vg.json"]
];

async function embedChart(id, filename) {
  const container = document.getElementById(id);

  if (!container) return;

  const response = await fetch(filename, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Unable to load ${filename}: ${response.status}`);
  }

  const specification = applyChartTheme(id, await response.json());

  const options = id === "accommodation-occupancy-radial"
    ? { ...embedOptions, patch: occupancyLayoutPatch }
    : embedOptions;

  const result = await vegaEmbed(container, specification, options);

  alignStoryWithPlot(container);

  if (id === "international-state-map") {
    enableMapNavigation(result.view, container);
  }

  if (id === "short-term-rental-map") {
    enableRentalMaps(result.view, container);
  }

  if (id === "short-term-rental-price-density") {
    enableRentalPriceSizing(result.view, container);
  }

  if (id === "accommodation-occupancy-radial") {
    enableOccupancySizing(result.view, container);
  }
}

for (const [id, filename] of charts) {
  embedChart(id, filename).catch(console.error);
}