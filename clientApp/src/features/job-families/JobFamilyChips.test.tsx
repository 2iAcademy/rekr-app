import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobFamilyChips } from './JobFamilyChips';

vi.mock('@/api/generated', () => ({
  jobFamilyControllerFindAll: vi.fn(() =>
    Promise.resolve({
      data: [
        { id: 13, label: 'Informatique' },
        { id: 4, label: 'Commerce' },
        { id: 7, label: 'Restauration' },
        { id: 9, label: 'Santé' },
      ],
    }),
  ),
}));

const PRIMARY_LEGEND = 'Lequel compte le plus ?';

const renderChips = (values: string[], onChange = vi.fn()) => {
  render(<JobFamilyChips values={values} onChange={onChange} />);

  return onChange;
};

describe('JobFamilyChips', () => {
  // Checking a trade that comes earlier in the list must not steal the
  // primary from the one the candidate picked first.
  it('garde le métier principal en tête quand on en coche un autre', async () => {
    const user = userEvent.setup();
    const onChange = renderChips(['13']);

    await user.click(await screen.findByRole('checkbox', { name: /Commerce/ }));

    expect(onChange).toHaveBeenCalledWith(['13', '4']);
  });

  it('ne demande pas de principal tant qu’un seul métier est coché', async () => {
    renderChips(['13']);

    await screen.findByRole('checkbox', { name: /Informatique/ });

    expect(screen.queryByRole('radiogroup', { name: PRIMARY_LEGEND })).not.toBeInTheDocument();
  });

  const radioOrder = async (): Promise<(string | null)[]> => {
    const group = await screen.findByRole('radiogroup', { name: PRIMARY_LEGEND });

    return Array.from(group.querySelectorAll('input[type="radio"]')).map((radio) =>
      radio.getAttribute('value'),
    );
  };

  // In the order of the chips above, not of the selection: the option the
  // candidate clicks must not jump to the left under their finger.
  it('propose de choisir le principal parmi les métiers cochés, dans l’ordre de la liste', async () => {
    renderChips(['13', '4']);

    expect(await radioOrder()).toEqual(['4', '13']);
    expect(screen.getByRole('radio', { name: 'Informatique' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Commerce' })).not.toBeChecked();
  });

  it('garde les choix à leur place quand le principal change', async () => {
    const { rerender } = render(<JobFamilyChips values={['13', '4']} onChange={vi.fn()} />);
    const before = await radioOrder();

    rerender(<JobFamilyChips values={['4', '13']} onChange={vi.fn()} />);

    expect(await radioOrder()).toEqual(before);
  });

  it('place en tête le métier choisi comme principal', async () => {
    const user = userEvent.setup();
    const onChange = renderChips(['13', '4', '9']);

    await user.click(await screen.findByRole('radio', { name: 'Santé' }));

    expect(onChange).toHaveBeenCalledWith(['9', '4', '13']);
  });

  // Said on screen because it is not what « principal » suggests: the other
  // trades stay in the deck, mixed in, only a little lower.
  it('explique que le principal ordonne sans filtrer', async () => {
    renderChips(['13', '4']);

    await screen.findByRole('radiogroup', { name: PRIMARY_LEGEND });

    expect(screen.getByText(/les autres restent dans votre feed/i)).toBeInTheDocument();
  });

  it('signale le métier principal sur sa pastille', async () => {
    renderChips(['4', '13']);

    const primary = await screen.findByRole('checkbox', { name: /Commerce/ });

    expect(primary).toHaveAccessibleName('Commerce (principal)');
    expect(screen.getByRole('checkbox', { name: /Informatique/ })).toHaveAccessibleName(
      'Informatique',
    );
  });

  /**
   * A visible badge made the primary pill wider, which pushed every pill after
   * it along the line — a tap aimed at one trade landed on the next. The mark
   * takes the place of the check icon instead, so the pill keeps its width.
   */
  /**
   * An account older than the rank has trades but no primary. Starring the
   * first of them would present as decided a choice nobody made.
   */
  it('ne présente aucun principal tant qu’il n’a pas été choisi', async () => {
    render(<JobFamilyChips values={['13', '4']} onChange={vi.fn()} primaryChosen={false} />);

    const pill = (await screen.findByRole('checkbox', { name: /Informatique/ })).closest('label');

    expect(pill?.querySelector('svg.lucide-star')).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Informatique/ })).toHaveAccessibleName(
      'Informatique',
    );
    expect(screen.getByRole('radio', { name: 'Informatique' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Commerce' })).not.toBeChecked();
  });

  it('marque le principal sans élargir sa pastille', async () => {
    renderChips(['4', '13']);

    const pill = (await screen.findByRole('checkbox', { name: /Commerce/ })).closest('label');
    const secondary = screen.getByRole('checkbox', { name: /Informatique/ }).closest('label');

    expect(pill?.querySelector('svg.lucide-star')).not.toBeNull();
    expect(pill?.querySelector('svg.lucide-check')).toBeNull();
    expect(secondary?.querySelector('svg.lucide-check')).not.toBeNull();
    // Only the icon changes: any text beyond the label is for screen readers.
    const visibleText = Array.from(pill?.querySelectorAll('span:not(.sr-only)') ?? []).map(
      (span) => span.textContent,
    );
    expect(visibleText).not.toContain('Principal');
  });
});
