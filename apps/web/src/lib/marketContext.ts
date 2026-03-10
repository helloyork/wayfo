/**
 * Market context presets for Wayfair - user selects from dropdown, no raw JSON needed.
 */

export const MARKET_CONTEXT_PRESETS: { value: string; label: string }[] = [
  {
    value: '{"locale":"en-US","country":"UNITED_STATES","brand":"WAYFAIR"}',
    label: "US · Wayfair (en-US)",
  },
  {
    value: '{"locale":"en-GB","country":"UNITED_KINGDOM","brand":"WAYFAIR"}',
    label: "UK · Wayfair (en-GB)",
  },
  {
    value: '{"locale":"de-DE","country":"GERMANY","brand":"WAYFAIR"}',
    label: "Germany · Wayfair (de-DE)",
  },
  {
    value: '{"locale":"en-CA","country":"CANADA","brand":"WAYFAIR"}',
    label: "Canada · Wayfair (en-CA)",
  },
  {
    value: '{"locale":"en-US","country":"UNITED_STATES","brand":"JOSS_AND_MAIN"}',
    label: "US · Joss & Main (en-US)",
  },
  {
    value: '{"locale":"en-US","country":"UNITED_STATES","brand":"PERIGOLD"}',
    label: "US · Perigold (en-US)",
  },
  {
    value: '{"locale":"en-US","country":"UNITED_STATES","brand":"ALLMODERN"}',
    label: "US · AllModern (en-US)",
  },
  {
    value: '{"locale":"en-US","country":"UNITED_STATES","brand":"BIRCHLANE"}',
    label: "US · Birch Lane (en-US)",
  },
];

export const DEFAULT_MARKET_CONTEXT =
  '{"locale":"en-US","country":"UNITED_STATES","brand":"WAYFAIR"}';
