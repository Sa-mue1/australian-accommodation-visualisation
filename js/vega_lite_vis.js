const embedOptions = {
  actions: true,
  renderer: "svg"
};

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
    } else if (event.key === "-" || event.key === "_") {
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

    const radius = Math.min(132, (width - 50) / 2);
    const size = `${columns}:${width}`;

    if (size === previousSize) return;

    previousSize = size;

    update({
      occupancy_columns: columns,
      child_width: width,
      child_height: radius * 2 + 84
    }, true);
  }

  const observer = new ResizeObserver(resizeChart);

  observer.observe(container);

  resizeChart();
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

for (const [id, specification] of charts) {
  const container = document.getElementById(id);

  if (!container) continue;

  const options = id === "accommodation-occupancy-radial"
    ? { ...embedOptions, patch: occupancyLayoutPatch }
    : embedOptions;

  vegaEmbed(container, specification, options)
    .then(result => {
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
    })
    .catch(console.error);
}