import { sniffFileExtension } from './file-content';
import {
  gifBuffer,
  jpegBuffer,
  pdfBuffer,
  pngBuffer,
  webpBuffer,
} from '../../test/file-fixtures';

describe('sniffFileExtension', () => {
  it('recognises a PDF by its header', () => {
    expect(sniffFileExtension(pdfBuffer())).toBe('pdf');
  });

  it('recognises a PNG by its signature', () => {
    expect(sniffFileExtension(pngBuffer())).toBe('png');
  });

  it('recognises a JPEG by its start-of-image marker', () => {
    expect(sniffFileExtension(jpegBuffer())).toBe('jpg');
  });

  it('recognises a WebP by its RIFF container', () => {
    expect(sniffFileExtension(webpBuffer())).toBe('webp');
  });

  it.each([
    ['an empty buffer', Buffer.alloc(0)],
    ['a buffer too short to carry any signature', Buffer.from([0xff, 0xd8])],
    [
      'a Linux executable',
      Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
    ],
    [
      'a Windows executable',
      Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
    ],
    ['a shell script', Buffer.from('#!/bin/sh\nrm -rf /\n')],
    ['plain text', Buffer.from('Bonjour, ceci est mon CV.')],
    [
      'an HTML page',
      Buffer.from('<!doctype html><html><body>hi</body></html>'),
    ],
    [
      'an SVG carrying a script',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    ],
    ['a PHP payload', Buffer.from('<?php system($_GET["c"]); ?>')],
    ['a GIF', gifBuffer()],
    [
      'a ZIP archive',
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
    ],
  ])('refuses %s', (_case, content) => {
    expect(sniffFileExtension(content)).toBeNull();
  });

  it('refuses a PDF whose header does not start at the first byte', () => {
    expect(
      sniffFileExtension(Buffer.concat([Buffer.from('\n'), pdfBuffer()])),
    ).toBeNull();
  });

  it('refuses a RIFF container that is not WebP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE'),
    ]);

    expect(sniffFileExtension(wav)).toBeNull();
  });
});
