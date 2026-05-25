import type { LabDefinition, Profile } from '../lab/types';
import { EURO_APP_URL, EURO_BLOCK_SCRIPT_PATTERNS, euroLiveProfile } from './euro-offline-replay-fixtures';

export const EURO_MENU_SCENARIO_ID = 'scenario-euro-open-menu';
export const EURO_SEARCH_LAYER_SCENARIO_ID = 'scenario-euro-search-layer';
export const EURO_PRODUCT_BOX_TO_PDP_SCENARIO_ID = 'scenario-euro-product-box-to-pdp';
export const EURO_ROTATOR_BANNER_CLICK_SCENARIO_ID = 'scenario-euro-rotator-banner-click';
export const EURO_PRODUCT_BOX_CARD_CLICK_SCENARIO_ID =
  'scenario-euro-product-box-card-click';
export const EURO_PROMO_TAG_CLICK_SCENARIO_ID = 'scenario-euro-promo-tag-click';
export const EURO_LISTING_OPEN_FILTERS_SCENARIO_ID = 'scenario-euro-listing-open-filters';
export const EURO_ADD_TO_CART_SCENARIO_ID = 'scenario-euro-add-to-cart';
export const EURO_PRODUCT_STANDARD_INSTALLMENTS_TAB_SCENARIO_ID =
  'scenario-euro-product-standard-installments-tab';
export const EURO_LISTING_SORT_SCENARIO_ID = 'scenario-euro-listing-sort';
export const EURO_LISTING_QUICK_FILTER_SCENARIO_ID = 'scenario-euro-listing-quick-filter';
export const EURO_LISTING_BRAND_FILTER_SCENARIO_ID = 'scenario-euro-listing-brand-filter';
export const EURO_LISTING_PRICE_FILTER_SCENARIO_ID = 'scenario-euro-listing-price-filter';
export const EURO_LISTING_SCROLL_PRODUCTS_SCENARIO_ID =
  'scenario-euro-listing-scroll-products';

export const EURO_MENU_SPEC_PATH = 'src/scenarios/playwright-web-vitals/euro-open-menu.spec.ts';
export const EURO_SEARCH_LAYER_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-search-layer.spec.ts';
export const EURO_PRODUCT_BOX_TO_PDP_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-product-box-to-pdp.spec.ts';
export const EURO_ROTATOR_BANNER_CLICK_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-rotator-banner-click.spec.ts';
export const EURO_PRODUCT_BOX_CARD_CLICK_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-product-box-card-click.spec.ts';
export const EURO_PROMO_TAG_CLICK_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-promo-tag-click.spec.ts';
export const EURO_LISTING_OPEN_FILTERS_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-listing-open-filters.spec.ts';
export const EURO_ADD_TO_CART_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-add-to-cart.spec.ts';
export const EURO_PRODUCT_STANDARD_INSTALLMENTS_TAB_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-product-standard-installments-tab.spec.ts';
export const EURO_LISTING_SORT_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-listing-sort.spec.ts';
export const EURO_LISTING_QUICK_FILTER_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-listing-quick-filter.spec.ts';
export const EURO_LISTING_BRAND_FILTER_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-listing-brand-filter.spec.ts';
export const EURO_LISTING_PRICE_FILTER_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-listing-price-filter.spec.ts';
export const EURO_LISTING_SCROLL_PRODUCTS_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/euro-listing-scroll-products.spec.ts';

const profileBase = {
  network: {
    kind: 'live' as const,
    baseUrl: EURO_APP_URL,
  },
};

export const euroMenuMethodologyProfiles: Profile[] = [
  euroLiveProfile({
    ...profileBase,
    id: 'baseline',
    label: 'Euro menu - browser cache warmed',
    role: 'baseline',
    warmup: 'warm_assets',
    network: {
      ...profileBase.network,
      browserCache: 'default',
      runtimeNetworkCache: 'default',
    },
  }),
  euroLiveProfile({
    ...profileBase,
    id: 'euro-menu-browser-cache-cold',
    label: 'Euro menu - browser cache cold',
    role: 'measurement',
    warmup: 'cold',
    network: {
      ...profileBase.network,
      browserCache: 'default',
      runtimeNetworkCache: 'default',
    },
  }),
  euroLiveProfile({
    ...profileBase,
    id: 'euro-menu-browser-cache-disabled',
    label: 'Euro menu - browser cache disabled',
    role: 'measurement',
    warmup: 'cold',
    network: {
      ...profileBase.network,
      browserCache: 'disabled',
      runtimeNetworkCache: 'disabled',
    },
  }),
  euroLiveProfile({
    ...profileBase,
    id: 'euro-menu-external-scripts-blocked-warm',
    label: 'Euro menu - external scripts blocked with warmed cache',
    role: 'measurement',
    warmup: 'warm_assets',
    network: {
      ...profileBase.network,
      blockScripts: EURO_BLOCK_SCRIPT_PATTERNS,
      browserCache: 'default',
      runtimeNetworkCache: 'default',
    },
  }),
];

export const euroMenuMethodologyLab: LabDefinition = {
  lab: {
    cohort: {
      hostClass: 'runtime-docker-isolated',
      appVersion: 'dev',
    },
    methodology: {
      replicates: 5,
      schedule: 'interleave',
      metric: 'inpMs',
      percentiles: [50, 75, 95],
      trimExtremesPercent: 10,
      gate: {
        baselineProfileId: 'baseline',
        acceptableDeltaMs: 40,
      },
    },
    client: 'playwright-web-vitals',
  },
  profiles: euroMenuMethodologyProfiles,
  scenarios: [
    {
      id: EURO_MENU_SCENARIO_ID,
      label: 'Euro hamburger menu click',
      specPath: EURO_MENU_SPEC_PATH,
      description: [
        'Prepare isolated runtime container',
        'Apply profile cache policy',
        'Click the Euro hamburger/category menu',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_SEARCH_LAYER_SCENARIO_ID,
      label: 'Euro open search layer',
      specPath: EURO_SEARCH_LAYER_SPEC_PATH,
      description: [
        'Open the Euro home page',
        'Focus and type into the search input to open the search layer',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_PRODUCT_BOX_TO_PDP_SCENARIO_ID,
      label: 'Euro product box to PDP',
      specPath: EURO_PRODUCT_BOX_TO_PDP_SPEC_PATH,
      description: [
        'Open the Euro home page',
        'Click a visible product box link',
        'Record whether the PDP navigation is blocked by Euro',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_ROTATOR_BANNER_CLICK_SCENARIO_ID,
      label: 'Euro rotator banner click',
      specPath: EURO_ROTATOR_BANNER_CLICK_SPEC_PATH,
      description: [
        'Open the Euro home page',
        'Click the active hero rotator banner',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_PRODUCT_BOX_CARD_CLICK_SCENARIO_ID,
      label: 'Euro product box card click',
      specPath: EURO_PRODUCT_BOX_CARD_CLICK_SPEC_PATH,
      description: [
        'Open the Euro home page',
        'Click a product box from a lower product carousel',
        'Record whether the PDP navigation is blocked by Euro',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_PROMO_TAG_CLICK_SCENARIO_ID,
      label: 'Euro promotional tag click',
      specPath: EURO_PROMO_TAG_CLICK_SPEC_PATH,
      description: [
        'Open the Euro home page',
        'Click a promotional tag in the hero rotator navigation',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_LISTING_OPEN_FILTERS_SCENARIO_ID,
      label: 'Euro listing open filters',
      specPath: EURO_LISTING_OPEN_FILTERS_SPEC_PATH,
      description: [
        'Open the smartphones listing',
        'Open a visible filter group',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_ADD_TO_CART_SCENARIO_ID,
      label: 'Euro add to cart',
      specPath: EURO_ADD_TO_CART_SPEC_PATH,
      description: [
        'Open the Euro home page',
        'Navigate through a product box toward PDP',
        'Click add-to-cart when the PDP is available',
        'Record PDP blocking when Euro prevents the add-to-cart path',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_PRODUCT_STANDARD_INSTALLMENTS_TAB_SCENARIO_ID,
      label: 'Euro standard/installments product tab',
      specPath: EURO_PRODUCT_STANDARD_INSTALLMENTS_TAB_SPEC_PATH,
      description: [
        'Open the Euro home page product carousel',
        'Click the visible installments area for a product box',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_LISTING_SORT_SCENARIO_ID,
      label: 'Euro listing sort',
      specPath: EURO_LISTING_SORT_SPEC_PATH,
      description: [
        'Open the smartphones listing',
        'Open listing sort control',
        'Select a sort option',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_LISTING_QUICK_FILTER_SCENARIO_ID,
      label: 'Euro listing quick filter',
      specPath: EURO_LISTING_QUICK_FILTER_SPEC_PATH,
      description: [
        'Open the smartphones listing',
        'Use a quick filter chip such as iPhone 17 or Galaxy S',
        'Wait for listing UI to react',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_LISTING_BRAND_FILTER_SCENARIO_ID,
      label: 'Euro listing brand filter',
      specPath: EURO_LISTING_BRAND_FILTER_SPEC_PATH,
      description: [
        'Open the smartphones listing',
        'Select a brand option such as Apple or Samsung',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_LISTING_PRICE_FILTER_SCENARIO_ID,
      label: 'Euro listing price filter',
      specPath: EURO_LISTING_PRICE_FILTER_SPEC_PATH,
      description: [
        'Open the smartphones listing',
        'Open the price filter group',
        'Enter a price range',
        'Measure INP through web-vitals/onINP',
      ],
    },
    {
      id: EURO_LISTING_SCROLL_PRODUCTS_SCENARIO_ID,
      label: 'Euro listing scroll products',
      specPath: EURO_LISTING_SCROLL_PRODUCTS_SPEC_PATH,
      description: [
        'Open the smartphones listing',
        'Scroll the listing/product area',
        'Collect listing state metrics',
        'Measure INP through web-vitals/onINP',
      ],
    },
  ],
};
