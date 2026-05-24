import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'bench' },
  {
    path: 'bench',
    loadComponent: () =>
      import('./bench/bench.component').then((m) => m.BenchComponent),
  },
  {
    path: 'scenario/a',
    loadComponent: () =>
      import('./scenarios/scenario-a.component').then((m) => m.ScenarioAComponent),
  },
  {
    path: 'scenario/b',
    loadComponent: () =>
      import('./scenarios/scenario-b-layout.component').then(
        (m) => m.ScenarioBLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./scenarios/scenario-b-home.component').then(
            (m) => m.ScenarioBHomeComponent,
          ),
      },
      {
        path: 'category',
        loadComponent: () =>
          import('./scenarios/scenario-b-category.component').then(
            (m) => m.ScenarioBCategoryComponent,
          ),
      },
    ],
  },
  {
    path: 'scenario/c',
    loadComponent: () =>
      import('./scenarios/scenario-c.component').then((m) => m.ScenarioCComponent),
  },
  {
    path: 'scenario/d/browse',
    loadComponent: () =>
      import('./scenarios/scenario-d-browse.component').then(
        (m) => m.ScenarioDBrowseComponent,
      ),
  },
  {
    path: 'scenario/d/cart',
    loadComponent: () =>
      import('./scenarios/scenario-d-cart.component').then(
        (m) => m.ScenarioDCartComponent,
      ),
  },
];
