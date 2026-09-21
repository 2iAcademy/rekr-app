import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppHeader } from './AppHeader';
import { AppShellSkeleton } from './AppShellSkeleton';
import { AppSidebar } from './AppSidebar';

const renderSkeleton = () => render(<AppShellSkeleton />);

/**
 * The class list of the real chrome, read from a render rather than copied
 * here: a width or height changed on one side only is exactly the jump the
 * skeleton exists to prevent.
 */
const realChromeClasses = () => {
  const user = { name: 'sacha', role: 'Candidat' };
  const items = [{ label: 'Profil', to: '/profil' }];
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <AppSidebar items={items} user={user} profileTo="/profil" />
            <AppHeader items={items} user={user} profileTo="/profil" />
          </>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );
  const view = render(<RouterProvider router={router} />);
  const classes = {
    sidebar: screen.getByRole('complementary').className.split(' '),
    header: screen.getByRole('banner').className.split(' '),
  };

  view.unmount();

  return classes;
};

const token = (classes: readonly string[], pattern: RegExp) =>
  classes.find((entry) => pattern.test(entry));

describe('AppShellSkeleton', () => {
  it('annonce le chargement de la session', () => {
    renderSkeleton();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre session');
  });

  // The point of the skeleton is to hold the layout without holding anything the
  // session owns: no identity, no navigation, and no main landmark that would be
  // duplicated the moment the real shell mounts.
  it('ne peint ni identité, ni navigation, ni point de repère principal', () => {
    renderSkeleton();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  // Same width, same height and same breakpoints as the real chromes, otherwise
  // the content jumps the moment the session lands.
  it('reprend la géométrie du shell et ses points de rupture', () => {
    const real = realChromeClasses();
    const { container } = renderSkeleton();
    const root = container.firstElementChild;
    const [sidebar, headerColumn] = [...(root?.children ?? [])].slice(1);
    const header = headerColumn.firstElementChild;

    expect(root?.className).toContain('overflow-x-clip');

    const sidebarWidth = token(real.sidebar, /^w-/);
    expect(sidebarWidth).toBeDefined();
    expect(sidebar.className.split(' ')).toContain(sidebarWidth);
    expect(sidebar.className).toContain('hidden');
    expect(sidebar.className).toContain('desktop:block');

    const headerHeight = token(real.header, /^h-/);
    expect(headerHeight).toBeDefined();
    expect(header?.className.split(' ')).toContain(headerHeight);
    expect(header?.className).toContain('desktop:hidden');
  });
});
