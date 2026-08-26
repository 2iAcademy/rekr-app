import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShellSkeleton } from './AppShellSkeleton';

const renderSkeleton = () => render(<AppShellSkeleton />);

describe('AppShellSkeleton', () => {
  it('annonce le chargement de la session', () => {
    renderSkeleton();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre session');
  });

  // The point of the skeleton is to hold the layout without holding anything the
  // session owns: no identity, no navigation, and no main landmark that would be
  // duplicated the moment the real shell mounts.
  it('ne peint ni identité, ni navigation, ni point de repère principal', () => {
    const { container } = renderSkeleton();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(container.querySelector('[data-role]')).toBeNull();
  });

  // jsdom loads no CSS, so the classes are the only trace of the two rules that
  // matter: the palette is role-scoped through `border-line` and every
  // `--role-*` token, so a skeleton that used them would leak the candidate
  // colours onto a recruiter's screen before the session lands.
  it('n’emprunte aucune couleur dépendante du rôle', () => {
    const { container } = renderSkeleton();
    const markup = container.innerHTML;

    expect(markup).not.toContain('border-line');
    expect(markup).not.toContain('text-brand');
    expect(markup).not.toContain('bg-brand');
    expect(markup).not.toContain('shadow-violet');
    expect(markup).not.toContain('bg-violet');
  });

  // Same width and same breakpoints as the real chromes, otherwise the content
  // jumps sideways the moment the session lands.
  it('reprend la géométrie du shell et ses points de rupture', () => {
    const { container } = renderSkeleton();
    const root = container.firstElementChild;
    const [sidebar, headerColumn] = [...(root?.children ?? [])].slice(1);

    expect(root?.className).toContain('overflow-x-clip');
    expect(sidebar.className).toContain('w-56');
    expect(sidebar.className).toContain('desktop:block');
    expect(headerColumn.firstElementChild?.className).toContain('desktop:hidden');
  });
});
