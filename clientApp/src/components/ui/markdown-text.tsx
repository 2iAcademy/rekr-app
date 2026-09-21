import { cn } from '@/lib/utils';
import { markdownBlocks, type Span } from '@/lib/markdown';

const renderSpans = (spans: Span[]) =>
  spans.map((span, index) => {
    if (span.bold) {
      return (
        <strong key={index} className="font-bold text-ink">
          {span.text}
        </strong>
      );
    }

    return span.italic ? <em key={index}>{span.text}</em> : <span key={index}>{span.text}</span>;
  });

interface MarkdownTextProps {
  source: string;
  className?: string;
}

/**
 * Read-only rendering of the Markdown the rich text editor stores (bold,
 * italic, bullet lists), as React elements rather than an HTML string.
 */
export function MarkdownText({ source, className }: MarkdownTextProps) {
  return (
    <div className={cn('flex flex-col gap-2 text-sm leading-relaxed text-ink-soft', className)}>
      {markdownBlocks(source).map((block, index) =>
        block.kind === 'list' ? (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-5 marker:text-ink-faint">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderSpans(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{renderSpans(block.spans)}</p>
        ),
      )}
    </div>
  );
}
