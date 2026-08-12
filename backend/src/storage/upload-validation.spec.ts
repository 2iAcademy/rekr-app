import { BadRequestException } from '@nestjs/common';
import {
  gifBuffer,
  jpegBuffer,
  pdfBuffer,
  pngBuffer,
  webpBuffer,
} from '../../test/file-fixtures';
import { FILE_KINDS } from './file-kind';
import { UploadedFile } from './uploaded-file.interface';
import { validateUploadedFile } from './upload-validation';

const asUpload = (
  buffer: Buffer,
  overrides: Partial<UploadedFile> = {},
): UploadedFile => ({
  buffer,
  size: buffer.length,
  originalname: 'whatever.bin',
  mimetype: 'application/octet-stream',
  ...overrides,
});

describe('validateUploadedFile', () => {
  it('accepts a PDF as a CV and reports its extension', () => {
    expect(validateUploadedFile('cv', asUpload(pdfBuffer())).extension).toBe(
      'pdf',
    );
  });

  it('hands back the exact bytes to store', () => {
    const content = pdfBuffer();

    expect(validateUploadedFile('cv', asUpload(content)).content).toEqual(
      content,
    );
  });

  it.each([
    ['png', pngBuffer()],
    ['jpg', jpegBuffer()],
    ['webp', webpBuffer()],
  ])('accepts a %s as a profile picture', (extension, content) => {
    expect(validateUploadedFile('picture', asUpload(content)).extension).toBe(
      extension,
    );
  });

  it('refuses an image where a CV is expected', () => {
    expect(() => validateUploadedFile('cv', asUpload(pngBuffer()))).toThrow(
      BadRequestException,
    );
  });

  it('refuses a PDF where an image is expected', () => {
    expect(() => validateUploadedFile('logo', asUpload(pdfBuffer()))).toThrow(
      BadRequestException,
    );
  });

  it('refuses a format supported by no kind at all', () => {
    expect(() =>
      validateUploadedFile('picture', asUpload(gifBuffer())),
    ).toThrow(BadRequestException);
  });

  it('refuses a missing file', () => {
    expect(() => validateUploadedFile('cv', undefined)).toThrow(
      BadRequestException,
    );
  });

  it('refuses an empty file', () => {
    expect(() => validateUploadedFile('cv', asUpload(Buffer.alloc(0)))).toThrow(
      BadRequestException,
    );
  });

  it('trusts the bytes, not the declared mimetype', () => {
    const disguisedPdf = asUpload(pdfBuffer(), {
      mimetype: 'image/png',
      originalname: 'photo.png',
    });

    expect(validateUploadedFile('cv', disguisedPdf).extension).toBe('pdf');
  });

  it('refuses a script that claims to be a PDF', () => {
    const disguisedScript = asUpload(
      Buffer.from('<?php system($_GET["c"]); ?>'),
      {
        mimetype: 'application/pdf',
        originalname: 'cv.pdf',
      },
    );

    expect(() => validateUploadedFile('cv', disguisedScript)).toThrow(
      BadRequestException,
    );
  });

  it('accepts a file sitting exactly on the limit of its kind', () => {
    const exactly = pngBuffer(FILE_KINDS.picture.maxBytes);

    expect(validateUploadedFile('picture', asUpload(exactly)).extension).toBe(
      'png',
    );
  });

  it('refuses a file one byte over the limit of its kind', () => {
    const oneTooMany = pngBuffer(FILE_KINDS.picture.maxBytes + 1);

    expect(() => validateUploadedFile('picture', asUpload(oneTooMany))).toThrow(
      BadRequestException,
    );
  });

  it('applies the limit of the kind, not a single global one', () => {
    const beyondPicture = pdfBuffer(FILE_KINDS.picture.maxBytes + 1);

    expect(validateUploadedFile('cv', asUpload(beyondPicture)).extension).toBe(
      'pdf',
    );
  });

  it('measures the buffer rather than the reported size', () => {
    const understated = asUpload(pngBuffer(FILE_KINDS.picture.maxBytes + 1), {
      size: 10,
    });

    expect(() => validateUploadedFile('picture', understated)).toThrow(
      BadRequestException,
    );
  });
});
