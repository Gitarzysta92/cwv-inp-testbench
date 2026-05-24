import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';

const KEY = 'bench-cart-qty';

@Component({
  selector: 'app-scenario-d-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scenario-d-cart.component.html',
  styleUrl: './scenario-d-cart.component.scss',
})
export class ScenarioDCartComponent implements OnInit {
  protected readonly qty = signal(0);

  ngOnInit(): void {
    const raw = sessionStorage.getItem(KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    this.qty.set(Number.isFinite(n) && n >= 0 ? n : 0);
  }

  protected bump(delta: number): void {
    this.qty.update((q) => {
      const next = Math.max(0, q + delta);
      sessionStorage.setItem(KEY, String(next));
      return next;
    });
  }
}
