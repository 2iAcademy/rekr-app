import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileField } from './FileField';
import { FILE_CONSTRAINTS } from './fileConstraints';

const MEGABYTE = 1024 * 1024;

const fileOf = (name: string, bytes = 1024): File => {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: bytes });

  return file;
};

const renderField = (props: Partial<Parameters<typeof FileField>[0]> = {}) =>
  render(
    <FileField
      label="Photo de profil"
      constraint={FILE_CONSTRAINTS.picture}
      onSelect={vi.fn()}
      {...props}
    />,
  );

const input = (label = 'Photo de profil') => screen.getByLabelText(label);

/**
 * `applyAccept: false` on the rejection cases: user-event honours the `accept`
 * attribute and would drop the file before the component ever sees it. A browser
 * treats `accept` the same way — a picker filter, not a guarantee, since a
 * drag-and-drop or an « all files » picker walks straight past it. The
 * component's own check is what must hold, so the tests exercise it directly.
 */
const uploadIgnoringAccept = (element: HTMLElement, file: File) =>
  userEvent.setup({ applyAccept: false }).upload(element, file);

describe('FileField', () => {
  it('étiquette réellement le champ de fichier et annonce les contraintes', () => {
    renderField();

    expect(input()).toHaveAttribute('type', 'file');
    expect(input()).toHaveAttribute('accept', '.jpg,.jpeg,.png,.webp');
    expect(screen.getByText('JPG, JPEG, PNG ou WEBP — 2 Mo maximum.')).toBeInTheDocument();
  });

  it('nomme chaque commande d’après son champ, pour deux champs côte à côte', () => {
    render(
      <>
        <FileField
          label="Photo de profil"
          constraint={FILE_CONSTRAINTS.picture}
          previewUrl="/api/files/candidates/abc.png"
          onSelect={vi.fn()}
          onRemove={vi.fn()}
        />
        <FileField
          label="CV"
          constraint={FILE_CONSTRAINTS.cv}
          hasFile
          onSelect={vi.fn()}
          onRemove={vi.fn()}
        />
      </>,
    );

    expect(input('Photo de profil')).toHaveAttribute('accept', '.jpg,.jpeg,.png,.webp');
    expect(input('CV')).toHaveAttribute('accept', '.pdf');
    expect(screen.getByRole('button', { name: 'Supprimer Photo de profil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer CV' })).toBeInTheDocument();
  });

  it('annonce un emplacement vide et n’offre pas de suppression', () => {
    renderField({ onRemove: vi.fn() });

    expect(screen.getByText('Aucun fichier')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument();
  });

  it('affiche l’aperçu du fichier existant quand c’est une image', () => {
    renderField({ previewUrl: '/api/files/candidates/abc.png' });

    const preview = screen.getByRole('img', { name: 'Photo de profil' });

    expect(preview).toHaveAttribute('src', '/api/files/candidates/abc.png');
    expect(screen.queryByText('Aucun fichier')).not.toBeInTheDocument();
  });

  it('affiche un libellé de présence, sans aperçu, pour un fichier non affichable', () => {
    renderField({
      label: 'CV',
      constraint: FILE_CONSTRAINTS.cv,
      hasFile: true,
      presentLabel: 'CV enregistré',
    });

    expect(screen.getByText('CV enregistré')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('propose la suppression seulement quand il y a un fichier à supprimer', () => {
    renderField({ previewUrl: '/api/files/candidates/abc.png', onRemove: vi.fn() });

    expect(screen.getByRole('button', { name: 'Supprimer Photo de profil' })).toBeInTheDocument();
  });

  it('n’affiche pas de suppression quand aucun retrait n’est possible', () => {
    renderField({ previewUrl: '/api/files/candidates/abc.png' });

    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument();
  });

  it('remonte le fichier choisi quand il respecte les contraintes', async () => {
    const onSelect = vi.fn();
    renderField({ onSelect });

    await userEvent.setup().upload(input(), fileOf('photo.png'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBeInstanceOf(File);
    expect((onSelect.mock.calls[0][0] as File).name).toBe('photo.png');
  });

  it('refuse une extension hors liste sans appeler le callback', async () => {
    const onSelect = vi.fn();
    renderField({ onSelect });

    await uploadIgnoringAccept(input(), fileOf('cv.pdf'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByText('Format non accepté : choisissez un fichier JPG, JPEG, PNG ou WEBP.'),
    ).toBeInTheDocument();
  });

  it('refuse un fichier trop volumineux sans appeler le callback', async () => {
    const onSelect = vi.fn();
    renderField({ onSelect });

    await uploadIgnoringAccept(input(), fileOf('photo.png', 2 * MEGABYTE + 1));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Fichier trop volumineux : 2 Mo maximum.')).toBeInTheDocument();
  });

  it('relie le message de refus au champ', async () => {
    renderField();

    await uploadIgnoringAccept(input(), fileOf('cv.pdf'));

    const alert = screen.getByRole('alert');

    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(input().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
  });

  it('efface le refus dès qu’un fichier conforme est choisi', async () => {
    const onSelect = vi.fn();
    renderField({ onSelect });

    await uploadIgnoringAccept(input(), fileOf('cv.pdf'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await uploadIgnoringAccept(input(), fileOf('photo.webp'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input()).not.toHaveAttribute('aria-invalid', 'true');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('demande le retrait du fichier au clic sur la suppression', async () => {
    const onRemove = vi.fn();
    renderField({ previewUrl: '/api/files/candidates/abc.png', onRemove });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Supprimer Photo de profil' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('désactive les commandes et annonce l’action pendant l’envoi', () => {
    renderField({
      previewUrl: '/api/files/candidates/abc.png',
      onRemove: vi.fn(),
      busy: true,
      busyLabel: 'Envoi de la photo…',
    });

    expect(input()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Supprimer Photo de profil' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Envoi de la photo…');
  });

  it('annonce un envoi générique quand aucun libellé n’est fourni', () => {
    renderField({ busy: true });

    expect(screen.getByRole('status')).toHaveTextContent('Envoi en cours…');
  });

  it('n’annonce rien hors envoi', () => {
    renderField();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marque le champ requis sans bloquer l’envoi natif du formulaire', () => {
    renderField({ required: true });

    expect(input()).toHaveAttribute('aria-required', 'true');
    expect(input()).not.toHaveAttribute('required');
  });

  it('accepte un état invalide et une description venus du parent', () => {
    render(
      <>
        <p id="ext-help">Le recruteur verra ce logo.</p>
        <FileField
          label="Logo"
          constraint={FILE_CONSTRAINTS.logo}
          onSelect={vi.fn()}
          invalid
          describedBy="ext-help"
        />
      </>,
    );

    expect(input('Logo')).toHaveAttribute('aria-invalid', 'true');
    expect(input('Logo').getAttribute('aria-describedby')?.split(' ')).toContain('ext-help');
  });

  // `fireEvent`, not `userEvent`: `upload(input, [])` dispatches nothing at all,
  // so it would assert against a component that was never called. A change
  // event carrying an empty list is what a cleared picker produces.
  it('ne remonte rien quand la sélection est vidée', () => {
    const onSelect = vi.fn();
    renderField({ onSelect });

    fireEvent.change(input(), { target: { files: [] } });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'false');
  });
});
