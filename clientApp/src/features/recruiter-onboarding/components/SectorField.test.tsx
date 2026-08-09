import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sectorControllerFindAll } from '@/api/generated';
import { SectorField } from './SectorField';

vi.mock('@/api/generated', () => ({ sectorControllerFindAll: vi.fn() }));

const findAll = vi.mocked(sectorControllerFindAll);

const answer = (labels: { id: number; label: string }[]) =>
  ({ data: labels, status: 200, headers: new Headers() }) as Awaited<
    ReturnType<typeof sectorControllerFindAll>
  >;

const field = () => screen.getByLabelText('Secteur');

describe('SectorField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findAll.mockResolvedValue(
      answer([
        { id: 4, label: 'Informatique & Numérique' },
        { id: 9, label: 'Juridique' },
      ]),
    );
  });

  // Postgres files accented initials after `Z`, so the API order puts
  // « Éducation » below « Transport ». A French reader looks under E.
  it('classe les secteurs dans l’ordre alphabétique français', async () => {
    findAll.mockResolvedValue(
      answer([
        { id: 1, label: 'Transport' },
        { id: 2, label: 'Éducation & Formation' },
        { id: 3, label: 'Commerce & Distribution' },
        { id: 4, label: 'Télécommunications' },
      ]),
    );
    render(<SectorField value="" onChange={vi.fn()} />);

    await waitFor(() => expect(field()).toBeEnabled());

    expect(
      screen
        .getAllByRole('option')
        .slice(1)
        .map((option) => option.textContent),
    ).toEqual([
      'Commerce & Distribution',
      'Éducation & Formation',
      'Télécommunications',
      'Transport',
    ]);
  });

  it('propose les secteurs du référentiel', async () => {
    render(<SectorField value="" onChange={vi.fn()} />);

    await waitFor(() => expect(field()).toBeEnabled());

    expect(screen.getByRole('option', { name: 'Informatique & Numérique' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Juridique' })).toBeInTheDocument();
  });

  // The wizard state holds strings, but the API expects the numeric id.
  it('remonte l’identifiant du secteur choisi', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<SectorField value="" onChange={onChange} />);
    await waitFor(() => expect(field()).toBeEnabled());

    await user.selectOptions(field(), '9');

    expect(onChange).toHaveBeenCalledWith('9');
  });

  it('affiche le secteur déjà retenu', async () => {
    render(<SectorField value="4" onChange={vi.fn()} />);

    await waitFor(() => expect(field()).toHaveValue('4'));
  });

  // A required field whose options never arrive would trap the recruiter on the
  // step, so the failure has to offer a way forward.
  it('permet de réessayer quand le référentiel ne charge pas', async () => {
    const user = userEvent.setup({ delay: null });
    findAll.mockRejectedValueOnce(new Error('Network error'));
    render(<SectorField value="" onChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les secteurs.',
    );

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(field()).toBeEnabled());
    expect(screen.getByRole('option', { name: 'Juridique' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reste inerte tant que le référentiel n’est pas arrivé', () => {
    render(<SectorField value="" onChange={vi.fn()} />);

    expect(field()).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Chargement des secteurs…' })).toBeInTheDocument();
  });

  it('relie le champ au message du wizard quand il est fautif', async () => {
    render(<SectorField value="" onChange={vi.fn()} invalid describedBy="wizard-error" />);

    await waitFor(() => expect(field()).toBeEnabled());

    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAttribute('aria-describedby', 'wizard-error');
    expect(field()).toHaveAttribute('aria-required', 'true');
  });
});
