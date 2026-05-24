import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-scenario-b-category',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scenario-b-category.component.html',
  styleUrl: './scenario-b-category.component.scss',
})
export class ScenarioBCategoryComponent {
  protected readonly applied = signal<number[]>([]);
  /** Long scroll filler for “browse” before filters */
  protected readonly filler = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`);

  protected toggleFilter(n: number): void {
    if (n < 1 || n > 4) return;
    this.applied.update((cur) =>
      cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b),
    );
  }
}
