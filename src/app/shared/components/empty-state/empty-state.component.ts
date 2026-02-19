import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <main [class]="containerClass">
      <h1 [class]="titleClass">{{ title }}</h1>
      <p [class]="descriptionClass">{{ description }}</p>
      <button type="button" [class]="buttonClass" (click)="action.emit()">
        {{ actionLabel }}
      </button>
    </main>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input({ required: true }) actionLabel = '';

  @Input() containerClass =
    'min-h-screen max-w-md md:max-w-none mx-auto w-full md:w-[70%] px-6 md:px-0 py-12 flex flex-col items-center justify-center text-center gap-4';
  @Input() titleClass = 'text-2xl font-bold text-slate-900 dark:text-white';
  @Input() descriptionClass = 'text-sm text-muted-foreground';
  @Input() buttonClass = 'bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-5 rounded-xl transition-all';

  @Output() action = new EventEmitter<void>();
}
