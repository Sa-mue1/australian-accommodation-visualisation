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
  { actions: true }
).catch(console.error);