const embedOptions = {
  actions: true,
  renderer: "svg"
};

function enableMapNavigation(view, container) {
  const svg = container.querySelector("svg.marks");
  const frame = svg?.querySelector("g.mark-group.role-frame.root");

  if (!svg || !frame) return;

  container.tabIndex = 0;
  container.setAttribute("role", "region");
  container.setAttribute(
    "aria-label",
    "Interactive Australian map. Drag to move. Scroll to zoom. Arrow keys move the view. Plus and minus zoom. Home resets."
  );

  const toolbar = document.createElement("div");
  toolbar.className = "map-toolbar";

  toolbar.innerHTML = `
    <div class="map-controls" role="group" aria-label="Map navigation">
      <button
        type="button"
        data-map-action="out"
        aria-label="Zoom out"
        title="Zoom out"
      >−</button>

      <output
        class="map-zoom-value"
        aria-label="Zoom level"
        aria-live="off"
      >100%</output>

      <button
        type="button"
        data-map-action="in"
        aria-label="Zoom in"
        title="Zoom in"
      >+</button>

      <button
        type="button"
        data-map-action="reset"
        class="map-reset"
        title="Show all of Australia"
      >Reset</button>
    </div>

    <p class="map-help">Drag to move. Scroll to zoom.</p>
  `;

  container.appendChild(toolbar);

  const zoomValue = toolbar.querySelector("output");
  const zoomIn = toolbar.querySelector('[data-map-action="in"]');
  const zoomOut = toolbar.querySelector('[data-map-action="out"]');

  let camera = {
    zoom: 1,
    x: 0,
    y: 0
  };

  let pending = null;
  let rendering = false;
  let animation = 0;
  let drag = null;

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const dimensions = () => ({
    width: Number(view.signal("width")),
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

  async function renderCamera() {
    animation = 0;

    if (rendering) return;

    rendering = true;

    try {
      while (pending) {
        const next = pending;
        pending = null;

        await view.runAsync(null, current => {
          current.signal("map_zoom", next.zoom);
          current.signal("map_pan_x", next.x);
          current.signal("map_pan_y", next.y);
        });
      }
    } catch (error) {
      console.error("Map navigation failed:", error);
    } finally {
      rendering = false;

      if (pending && !animation) {
        animation = requestAnimationFrame(renderCamera);
      }
    }
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

    pending = { ...camera };

    zoomValue.textContent = `${Math.round(zoom * 100)}%`;

    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 6;

    if (!animation && !rendering) {
      animation = requestAnimationFrame(renderCamera);
    }
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

    if (action === "in") {
      changeZoom(1.35);
    }

    if (action === "out") {
      changeZoom(1 / 1.35);
    }

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

    const delta = event.deltaY * multiplier;
    const factor = Math.exp(-clamp(delta, -250, 250) * 0.002);

    if (clamp(camera.zoom * factor, 1, 6) === camera.zoom) {
      return;
    }

    event.preventDefault();
    changeZoom(factor, point);
  }, { passive: false });

  svg.addEventListener("pointerdown", event => {
    const point = plotPoint(event);

    if (event.button !== 0 || drag || !inside(point)) {
      return;
    }

    event.preventDefault();

    container.focus({
      preventScroll: true
    });

    drag = {
      id: event.pointerId,
      point,
      x: camera.x,
      y: camera.y
    };

    svg.setPointerCapture(event.pointerId);
    container.classList.add("is-dragging");
  });

  svg.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) {
      return;
    }

    const point = plotPoint(event);

    if (!point) return;

    moveCamera({
      zoom: camera.zoom,
      x: drag.x + point.x - drag.point.x,
      y: drag.y + point.y - drag.point.y
    });
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) {
      return;
    }

    const pointerId = drag.id;

    drag = null;
    container.classList.remove("is-dragging");

    if (svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
  }

  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("lostpointercapture", endDrag);

  container.addEventListener("keydown", event => {
    if (event.target.closest("button, summary, a, input")) {
      return;
    }

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

const charts = [
  [
    "domestic-recovery",
    "domestic_recovery.vg.json"
  ],
  [
    "domestic-quarters",
    "domestic_state_quarters.vg.json"
  ],
  [
    "international-state-map",
    "international_state_recovery.vg.json"
  ],
  [
    "short-term-rental-map",
    "short_term_rental_symbols.vg.json"
  ],
  [
    "international-origin-flow",
    "international_origin_flow.vg.json"
  ],
  [
    "international-accommodation-change",
    "international_accommodation_change.vg.json"
  ],
  [
    "hotel-destination-rankings",
    "hotel_destination_rankings.vg.json"
  ],
  [
    "short-term-rental-price-density",
    "short_term_rental_price_density.vg.json"
  ],
  [
    "domestic-accommodation-streamgraph",
    "domestic_accommodation_streamgraph.vg.json"
  ],
  [
    "state-accommodation-mosaic",
    "state_accommodation_mosaic.vg.json"
  ],
  [
    "accommodation-occupancy-radial",
    "accommodation_occupancy_radial.vg.json"
  ]
];

for (const [id, specification] of charts) {
  const container = document.getElementById(id);

  if (!container) continue;

  vegaEmbed(container, specification, embedOptions)
    .then(result => {
      if (id === "international-state-map") {
        enableMapNavigation(result.view, container);
      }
    })
    .catch(console.error);
}