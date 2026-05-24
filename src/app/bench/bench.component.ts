import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { BenchItem } from './bench.models';

type CategoryFilter = 'all' | BenchItem['category'];

@Component({
  selector: 'app-bench',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bench.component.html',
  styleUrl: './bench.component.scss',
})
export class BenchComponent implements OnInit {
  protected readonly loadError = signal<string | null>(null);
  protected readonly items = signal<BenchItem[]>([]);
  protected readonly category = signal<CategoryFilter>('all');
  protected readonly searchQuery = signal('');
  protected readonly cartQty = signal(0);

  protected readonly filteredItems = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.category();
    return this.items().filter((item) => {
      const catOk = cat === 'all' || item.category === cat;
      const qOk = !q || item.name.toLowerCase().includes(q);
      return catOk && qOk;
    });
  });

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ items: BenchItem[] }>('/api/items').subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loadError.set(null);
      },
      error: () => this.loadError.set('Failed to load catalog'),
    });
  }

  protected setCategory(c: CategoryFilter): void {
    this.category.set(c);
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected addToCart(): void {
    this.cartQty.update((n) => n + 1);
  }

  protected bumpCart(delta: number): void {
    this.cartQty.update((n) => Math.max(0, n + delta));
  }
}
