import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BenchItem } from '../bench/bench.models';

@Component({
  selector: 'app-scenario-d-browse',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './scenario-d-browse.component.html',
  styleUrl: './scenario-d-browse.component.scss',
})
export class ScenarioDBrowseComponent implements OnInit {
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<BenchItem[]>([]);

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ items: BenchItem[] }>('/api/items').subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.error.set(null);
      },
      error: () => this.error.set('Failed to load'),
    });
  }

  protected addFirst(): void {
    sessionStorage.setItem('bench-cart-qty', '1');
  }
}
