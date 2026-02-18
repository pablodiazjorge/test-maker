import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `,
  styles: [],
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);

  constructor() {
    this.document.documentElement.classList.add('dark');
    this.document.body.classList.add('dark');
  }
}
