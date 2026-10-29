import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'acme-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <header class="app-header">
      <a class="brand" routerLink="/invoices">Acme Invoices</a>
    </header>
    <main class="app-main">
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
