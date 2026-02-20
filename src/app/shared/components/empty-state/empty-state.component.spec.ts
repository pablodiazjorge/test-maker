import { describe, expect, it, vi } from 'vitest';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('has expected default style classes', () => {
    const component = new EmptyStateComponent();
    expect(component.containerClass).toContain('min-h-screen');
    expect(component.titleClass).toContain('text-2xl');
    expect(component.buttonClass).toContain('bg-primary');
  });

  it('emits action event', () => {
    const component = new EmptyStateComponent();
    const listener = vi.fn();
    component.action.subscribe(listener);

    component.action.emit();

    expect(listener).toHaveBeenCalledOnce();
  });
});
