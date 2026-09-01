import { describe, it, expect } from 'vitest';
import {
  FILE_CONSTRAINTS,
  acceptAttribute,
  constraintHint,
  extensionsLabel,
  maxSizeLabel,
  validateFile,
} from './fileConstraints';

const MEGABYTE = 1024 * 1024;

const fileOf = (name: string, bytes: number): File => {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: bytes });

  return file;
};

describe('FILE_CONSTRAINTS', () => {
  it('reprend les règles du backend pour les quatre emplacements', () => {
    expect(FILE_CONSTRAINTS.picture).toEqual({
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 2 * MEGABYTE,
    });
    expect(FILE_CONSTRAINTS.cv).toEqual({ extensions: ['pdf'], maxBytes: 5 * MEGABYTE });
    expect(FILE_CONSTRAINTS.logo).toEqual({
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 2 * MEGABYTE,
    });
    expect(FILE_CONSTRAINTS.coverImage).toEqual({
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 5 * MEGABYTE,
    });
  });
});

describe('acceptAttribute', () => {
  it('préfixe chaque extension d’un point, séparées par des virgules', () => {
    expect(acceptAttribute(FILE_CONSTRAINTS.picture)).toBe('.jpg,.jpeg,.png,.webp');
  });

  it('reste valide pour une extension unique', () => {
    expect(acceptAttribute(FILE_CONSTRAINTS.cv)).toBe('.pdf');
  });
});

describe('extensionsLabel', () => {
  it('énumère les formats en majuscules, le dernier introduit par « ou »', () => {
    expect(extensionsLabel(FILE_CONSTRAINTS.picture)).toBe('JPG, JPEG, PNG ou WEBP');
  });

  it('n’ajoute pas de « ou » pour un format unique', () => {
    expect(extensionsLabel(FILE_CONSTRAINTS.cv)).toBe('PDF');
  });
});

describe('maxSizeLabel', () => {
  it('exprime la taille maximale en mégaoctets', () => {
    expect(maxSizeLabel(FILE_CONSTRAINTS.picture)).toBe('2 Mo');
    expect(maxSizeLabel(FILE_CONSTRAINTS.cv)).toBe('5 Mo');
  });

  it('utilise la virgule décimale pour une limite non entière', () => {
    expect(maxSizeLabel({ extensions: ['pdf'], maxBytes: 1.5 * MEGABYTE })).toBe('1,5 Mo');
  });
});

describe('constraintHint', () => {
  it('réunit formats et taille maximale en une phrase', () => {
    expect(constraintHint(FILE_CONSTRAINTS.cv)).toBe('PDF — 5 Mo maximum.');
  });
});

describe('validateFile', () => {
  it('accepte un fichier conforme', () => {
    expect(validateFile(fileOf('photo.png', 500), FILE_CONSTRAINTS.picture)).toBeNull();
  });

  it('accepte une extension écrite en majuscules', () => {
    expect(validateFile(fileOf('PHOTO.JPEG', 500), FILE_CONSTRAINTS.picture)).toBeNull();
  });

  it('accepte un fichier exactement à la limite de taille', () => {
    expect(validateFile(fileOf('photo.png', 2 * MEGABYTE), FILE_CONSTRAINTS.picture)).toBeNull();
  });

  it('refuse une extension hors liste', () => {
    expect(validateFile(fileOf('cv.pdf', 500), FILE_CONSTRAINTS.picture)).toBe(
      'Format non accepté : choisissez un fichier JPG, JPEG, PNG ou WEBP.',
    );
  });

  it('refuse un nom de fichier sans extension', () => {
    expect(validateFile(fileOf('capture', 500), FILE_CONSTRAINTS.picture)).toBe(
      'Format non accepté : choisissez un fichier JPG, JPEG, PNG ou WEBP.',
    );
  });

  it('refuse un fichier vide', () => {
    expect(validateFile(fileOf('photo.png', 0), FILE_CONSTRAINTS.picture)).toBe(
      'Ce fichier est vide.',
    );
  });

  it('refuse un fichier au-delà de la taille maximale', () => {
    expect(validateFile(fileOf('cv.pdf', 5 * MEGABYTE + 1), FILE_CONSTRAINTS.cv)).toBe(
      'Fichier trop volumineux : 5 Mo maximum.',
    );
  });

  it('signale le format avant la taille quand les deux sont en cause', () => {
    expect(validateFile(fileOf('archive.zip', 50 * MEGABYTE), FILE_CONSTRAINTS.cv)).toBe(
      'Format non accepté : choisissez un fichier PDF.',
    );
  });
});
