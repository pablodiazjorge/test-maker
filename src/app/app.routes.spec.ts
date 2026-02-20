import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
  it('defines expected route paths in order', () => {
    expect(routes.map((route) => route.path)).toEqual(['', 'config', 'quiz', 'results', '**']);
  });

  it('protects config, quiz and results routes', () => {
    const config = routes.find((route) => route.path === 'config');
    const quiz = routes.find((route) => route.path === 'quiz');
    const results = routes.find((route) => route.path === 'results');

    expect(config?.canActivate?.length).toBe(1);
    expect(quiz?.canActivate?.length).toBe(2);
    expect(results?.canActivate?.length).toBe(2);
  });

  it('redirects wildcard path to login', () => {
    const wildcard = routes.find((route) => route.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });

  it('resolves lazy components', async () => {
    const login = routes.find((route) => route.path === '');
    const config = routes.find((route) => route.path === 'config');
    const quiz = routes.find((route) => route.path === 'quiz');
    const results = routes.find((route) => route.path === 'results');

    await expect(login?.loadComponent?.()).resolves.toBeDefined();
    await expect(config?.loadComponent?.()).resolves.toBeDefined();
    await expect(quiz?.loadComponent?.()).resolves.toBeDefined();
    await expect(results?.loadComponent?.()).resolves.toBeDefined();
  });
});
