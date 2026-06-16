# CWV Test Bench

Lab do porownywania wplywu konfiguracji runtime na Core Web Vitals, przede
wszystkim INP, dla realnych scenariuszy uzytkownika.

Aktualny glowny przypadek uzycia to `euro.com.pl`: scenariusze Playwright
wykonuja konkretne akcje uzytkownika, runtime kontroluje przegladarke i siec,
a lab agreguje wyniki z wielu przebiegow.

## Architektura

```mermaid
flowchart TD
  A["Experiment config<br/>profiles x scenarios x runs"] --> B["Orchestrator"]

  B --> C["Scheduler<br/>tworzy plaska liste uruchomien"]
  C --> D["Run instruction<br/>profile + scenario + runIndex"]

  D --> E["Runtime Docker<br/>izolowane srodowisko per run"]

  E --> E1["Chrome / Playwright endpoint"]
  E --> E2["Warmup cache"]
  E --> E3["Custom network cache / replay"]
  E --> E4["Blocking external scripts"]
  E --> E5["Network stats"]

  E1 --> F["Client<br/>playwright-web-vitals"]

  F --> G["Scenario<br/>akcja uzytkownika"]
  G --> H["web-vitals<br/>INP / timing"]
  E5 --> I["Raw observation"]

  H --> I
  I --> J["Lab analysis"]

  J --> J1["Kwalifikacja probek<br/>metricBoundaries"]
  J --> J2["Median / mean / min / max / delta"]
  J --> J3["Porownanie do baseline"]
  J --> J4["Gate<br/>acceptable delta"]

  J --> K["Report<br/>wynik eksperymentu"]
```

## Podzial Odpowiedzialnosci

```mermaid
flowchart TB
  subgraph Runtime
    R1["uruchamia browser"]
    R2["robi warmup"]
    R3["obsluguje cache/replay"]
    R4["blokuje requesty/skrypty"]
    R5["zbiera network stats"]
  end

  subgraph Client
    C1["odpala Playwright"]
    C2["wykonuje scenariusz"]
    C3["zbiera web-vitals"]
  end

  subgraph Orchestrator
    O1["buduje plan uruchomien"]
    O2["odpala runtime per run"]
    O3["zapisuje raw results"]
  end

  subgraph Lab
    L1["agreguje wyniki"]
    L2["liczy statystyki kwalifikowanych probek"]
    L3["porownuje profile"]
    L4["generuje raport"]
  end

  Orchestrator --> Runtime
  Runtime --> Client
  Client --> Orchestrator
  Orchestrator --> Lab
```

## Model Metodyki

```mermaid
flowchart LR
  P["Profiles<br/>baseline, cold, cache disabled,<br/>scripts blocked"] --> X["Cross product"]
  S["Scenarios<br/>menu, search, listing,<br/>PDP, cart"] --> X
  R["Runs<br/>np. 5 teraz, docelowo 100"] --> X

  X --> O["Orchestrator schedule<br/>interleave"]
  O --> N["Raw observations"]
  N --> L["Lab methodology"]
  L --> V["Wynik statystyczny"]
```

Orchestrator nie liczy wyniku metodologicznego. Jego odpowiedzialnosc to
rozwiniecie `profiles x scenarios x runs` do plaskiej listy instrukcji i
uruchomienie ich w izolowanym runtime.

Lab dostaje raw observations i dopiero tam liczy wynik.

## Metodyka Liczenia

Kazdy run zapisuje raw observation dla kombinacji:

```text
profile x scenario x run
```

Agregacja jest liczona osobno dla:

```text
profileId x scenarioId x clientId x metric
```

Dla kazdej metryki:

1. brane sa tylko poprawne obserwacje (`status = ok`),
2. raw values sa zapisywane w raporcie dla audytu,
3. wartosci sa kwalifikowane wedlug `metricBoundaries`, np. `inpMs: 10..300`,
4. wyniki poza zakresem sa raportowane jako out-of-range, a nie mieszane z wynikiem bazowym,
5. dla wartosci kwalifikujacych sie liczone sa: mediana, srednia, min, max i delta (`max - min`),
6. liczony jest procent out-of-range wzgledem wszystkich runow,
7. liczone sa delty wzgledem baseline dla mediany, sredniej i delty.

Percentyle `p50`, `p75`, `p95` sa nadal dolaczane jako pomocnicze pola raportu,
ale podstawowy model oceny to mediana/srednia/min/max/delta po kwalifikacji.

`wallClockMs` to calkowity czas wykonania scenariusza od startu do konca:
nawigacja, oczekiwanie na load, czyszczenie overlayow, akcja uzytkownika i
kontrole po akcji. To nie jest samo INP.

`interactionWallMs` to czas od rozpoczecia mierzonej akcji uzytkownika do
zakonczenia kontroli po tej akcji. Dla hamburgera obejmuje klikniecie, wykrycie
menu albo odczyt INP oraz stabilizacyjny wait scenariusza.

## Profile Euro

Aktualny eksperyment Euro porownuje:

| Profil | Cel |
|---|---|
| `baseline` | warmed browser cache + runtime cache |
| `euro-menu-browser-cache-cold` | zimny browser cache |
| `euro-menu-browser-cache-disabled` | browser cache disabled + runtime network cache disabled |
| `euro-menu-external-scripts-blocked-warm` | warmed cache + blokowanie external scripts |

Glowna metryka metodologii:

```text
metric: inpMs
metricBoundaries: inpMs 10..300, eventTimingMaxMs 10..300
summary: median / mean / min / max / delta / out-of-range
schedule: interleave
gate: baseline + acceptableDeltaMs = 40
```

## Scenariusze Euro

Scenariusze sa trzymane jako osobne pliki w
`src/scenarios/playwright-web-vitals`.

Aktualnie mamy m.in.:

| Scenariusz | Plik |
|---|---|
| hamburger menu | `euro-open-menu.spec.ts` |
| search layer | `euro-search-layer.spec.ts` |
| rotator banner click | `euro-rotator-banner-click.spec.ts` |
| product box to PDP | `euro-product-box-to-pdp.spec.ts` |
| product box card click | `euro-product-box-card-click.spec.ts` |
| promo tag click | `euro-promo-tag-click.spec.ts` |
| listing open filters | `euro-listing-open-filters.spec.ts` |
| add to cart | `euro-add-to-cart.spec.ts` |
| standard/installments tab | `euro-product-standard-installments-tab.spec.ts` |
| listing sort | `euro-listing-sort.spec.ts` |
| listing quick filter | `euro-listing-quick-filter.spec.ts` |
| listing brand filter | `euro-listing-brand-filter.spec.ts` |
| listing price filter | `euro-listing-price-filter.spec.ts` |
| listing scroll products | `euro-listing-scroll-products.spec.ts` |

Scenariusze PDP/listing sa defensywne wobec blokady Euro: kiedy strona zwroci
block page, zapisujemy ten stan w `meta`/`metrics` zamiast falszowac pelna
sciezke.

## Przykladowy Wynik

Sesja: `e8bae544-a99c-4657-9be8-8548f91a25f4`  
Scenariusz: `scenario-euro-open-menu`  
Replikacje: `10` na profil

| Profil | INP median | INP mean | Out-of-range | INP min | INP max | INP delta |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 40 ms | 36.8 ms | 0% | 32 ms | 40 ms | 8 ms |
| cold browser cache | 40 ms | 38.4 ms | 0% | 32 ms | 48 ms | 16 ms |
| cache disabled | 32 ms | 35.2 ms | 0% | 32 ms | 40 ms | 8 ms |
| external scripts blocked | 32 ms | 33.6 ms | 0% | 24 ms | 40 ms | 16 ms |

Wniosek z malej proby: blokowanie external scripts poprawilo median INP o ok.
`8 ms` wzgledem baseline. To jest sygnal kierunku, nie finalny wniosek
statystyczny. Docelowo potrzebujemy wiecej scenariuszy i wiecej replikacji,
np. `100` runow na profil.

## Uruchamianie

Instalacja zaleznosci:

```bash
npm ci
```

Sprawdzenie TypeScript:

```bash
npx tsc --noEmit
```

Build obrazu runtime:

```bash
npm run runtime:docker:build
```

Eksperyment Euro przez izolowany orchestrator:

```bash
npm run bench:euro
```

Szybszy wariant — tylko hamburger menu (4 profile × 5 replik = 20 kroków):

```bash
npm run bench:euro:menu
```

Szczegoly typow eksperymentow (lab / runtime / import): `src/experiments/README.md`.

Liczbe replikacji mozna nadpisac:

```bash
BENCH_REPLICATES=100 npm run bench:euro
```

Wyniki trafiaja do:

```text
bench-results/observations/<sessionId>/
bench-results/summary/<sessionId>/report.json
bench-results/summary/<sessionId>/report.tsv
```
