import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';

export type ProductDemo = {
  title: string;
  thumbnails: string[];
};

@Component({
  selector: 'app-scenario-a',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scenario-a.component.html',
  styleUrl: './scenario-a.component.scss',
})
export class ScenarioAComponent implements OnInit {
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<ProductDemo | null>(null);
  protected readonly selected = signal(0);

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<ProductDemo>('/api/product/demo').subscribe({
      next: (d) => {
        this.data.set(d);
        this.error.set(null);
      },
      error: () => this.error.set('Failed to load product'),
    });
  }

  protected selectThumb(i: number): void {
    this.selected.set(i);
  }
}
