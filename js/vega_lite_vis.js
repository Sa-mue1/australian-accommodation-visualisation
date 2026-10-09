const embedOptions = {
  actions: true,
  renderer: "svg"
};

vegaEmbed(
  "#domestic-recovery",
  "domestic_recovery.vg.json",
  embedOptions
).catch(console.error);

vegaEmbed(
  "#domestic-quarters",
  "domestic_state_quarters.vg.json",
  embedOptions
).catch(console.error);

vegaEmbed(
  "#international-state-map",
  "international_state_recovery.vg.json",
  embedOptions
).catch(console.error);

vegaEmbed(
  "#short-term-rental-map",
  "short_term_rental_symbols.vg.json",
  embedOptions
).catch(console.error);

vegaEmbed(
  "#international-origin-flow",
  "international_origin_flow.vg.json",
  embedOptions
).catch(console.error);

vegaEmbed(
  "#international-accommodation-change",
  "international_accommodation_change.vg.json",
  embedOptions
).catch(console.error);

vegaEmbed(
  "#hotel-destination-rankings",
  "hotel_destination_rankings.vg.json",
  embedOptions
).catch(console.error);