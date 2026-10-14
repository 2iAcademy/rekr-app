import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { routes } from '@/router';
import { SiteMapPage } from './SiteMapPage';

interface RouteLike {
  path?: string;
  children?: RouteLike[];
}

const declared = (list: RouteLike[]): string[] =>
  list.flatMap((route) => [...(route.path ? [route.path] : []), ...declared(route.children ?? [])]);

describe('SiteMapPage', () => {
  it('regroupe les pages par public', () => {
    render(
      <MemoryRouter>
        <SiteMapPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Plan du site' })).toBeInTheDocument();
    for (const name of ['Pour tous', 'Candidat', 'Recruteur']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('ne pointe que vers des routes déclarées', () => {
    render(
      <MemoryRouter>
        <SiteMapPage />
      </MemoryRouter>,
    );

    const paths = declared(routes);
    for (const link of within(screen.getByRole('main')).getAllByRole('link')) {
      expect(paths).toContain(link.getAttribute('href'));
    }
  });
});
