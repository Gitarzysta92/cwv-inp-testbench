import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scenario-c',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scenario-c.component.html',
  styleUrl: './scenario-c.component.scss',
})
export class ScenarioCComponent {
  protected readonly query = signal('');
}
