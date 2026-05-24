import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-scenario-b-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="sbh" data-testid="scenario-b-home">
      <h1>Scenario B — home</h1>
      <p>
        <a data-testid="go-category" routerLink="/scenario/b/category">Go to category</a>
      </p>
    </main>
  `,
  styles: [
    `
      .sbh {
        font-family: system-ui, sans-serif;
        padding: 1.25rem;
        max-width: 40rem;
        margin: 0 auto;
      }
    `,
  ],
})
export class ScenarioBHomeComponent {}
