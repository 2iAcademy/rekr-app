/**
 * Minimal Markdown reader for the subset the editor produces: bold, italic and
 * bullet lists.
 *
 * `markdownToHtml` builds an HTML string, which the editor assigns to
 * `innerHTML`, so every piece of user text goes through `escapeHtml` — nothing
 * here is ever interpolated into an attribute, and there is no
 * `dangerouslySetInnerHTML` anywhere.
 */
interface Span {
  text: string;
  bold?: true;
  italic?: true;
}

const BULLET = '- ';

// Bold first: `*` would otherwise swallow the opening half of `**`.
const MARKS = [
  { mark: '**', style: 'bold' as const },
  { mark: '*', style: 'italic' as const },
];

/**
 * First pair wrapping actual content. Empty pairs are skipped rather than
 * matched: in `Une **équipe`, a lone `*` would otherwise pair the two asterisks
 * of the unclosed `**` and emit an empty italic span.
 */
const findPair = (line: string, mark: string): { open: number; close: number } | null => {
  let open = line.indexOf(mark);

  while (open !== -1) {
    const close = line.indexOf(mark, open + mark.length);
    if (close === -1) {
      return null;
    }

    if (close > open + mark.length) {
      return { open, close };
    }

    open = line.indexOf(mark, close + mark.length);
  }

  return null;
};

const parseSpans = (line: string): Span[] => {
  for (const { mark, style } of MARKS) {
    const pair = findPair(line, mark);
    if (!pair) {
      continue;
    }

    const { open, close } = pair;
    const before = line.slice(0, open);
    const inner = line.slice(open + mark.length, close);
    const after = line.slice(close + mark.length);

    return [
      ...(before === '' ? [] : parseSpans(before)),
      { text: inner, [style]: true },
      ...(after === '' ? [] : parseSpans(after)),
    ];
  }

  return [{ text: line }];
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const spansToHtml = (spans: Span[]): string =>
  spans
    .map((span) => {
      const text = escapeHtml(span.text);

      if (span.bold) {
        return `<strong>${text}</strong>`;
      }

      return span.italic ? `<em>${text}</em>` : text;
    })
    .join('');

/**
 * Markdown to the HTML shown inside the editable area.
 *
 * One block per line: while editing, a line the recruiter typed must stay a
 * line.
 *
 * Every piece of text goes through `escapeHtml`. This string is assigned to
 * `innerHTML`, so that escaping is the only thing standing between a typed
 * `<script>` and a real element.
 */
export const markdownToHtml = (source: string): string => {
  if (source === '') {
    return '<div><br></div>';
  }

  const blocks: string[] = [];
  let items: string[] = [];

  const flushList = (): void => {
    if (items.length > 0) {
      blocks.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      items = [];
    }
  };

  for (const line of source.split('\n')) {
    if (line.startsWith(BULLET)) {
      items.push(spansToHtml(parseSpans(line.slice(BULLET.length))));
      continue;
    }

    flushList();
    blocks.push(`<div>${line === '' ? '<br>' : spansToHtml(parseSpans(line))}</div>`);
  }

  flushList();

  return blocks.join('');
};

const inlineToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const inner = [...element.childNodes].map(inlineToMarkdown).join('');
  const tag = element.tagName.toLowerCase();

  if (tag === 'br') {
    return '\n';
  }

  if (inner === '') {
    return '';
  }

  // `execCommand` emits `b`/`i` on some browsers and `strong`/`em` on others.
  if (tag === 'strong' || tag === 'b') {
    return `**${inner}**`;
  }

  return tag === 'em' || tag === 'i' ? `*${inner}*` : inner;
};

/**
 * The editable area's HTML back to the Markdown that gets stored. Anything the
 * editor cannot express is dropped, but its text is kept.
 */
export const htmlToMarkdown = (html: string): string => {
  const root = document.createElement('div');
  root.innerHTML = html;

  const lines: string[] = [];
  let buffer = '';

  const flushBuffer = (): void => {
    if (buffer !== '') {
      lines.push(buffer);
      buffer = '';
    }
  };

  for (const node of root.childNodes) {
    const tag =
      node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).tagName.toLowerCase() : '';

    if (tag === 'ul' || tag === 'ol') {
      flushBuffer();
      for (const item of (node as HTMLElement).querySelectorAll('li')) {
        lines.push(`${BULLET}${inlineToMarkdown(item)}`);
      }
      continue;
    }

    if (tag === 'div' || tag === 'p') {
      flushBuffer();
      const text = inlineToMarkdown(node);
      lines.push(text === '\n' ? '' : text);
      continue;
    }

    buffer += inlineToMarkdown(node);
  }

  flushBuffer();

  // A contentEditable always keeps a trailing empty block; storing it would add
  // a stray newline to the value on every edit.
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
};
