import type { ReactElement } from 'react';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';
import seedancePromptGuide from './seedancePromptGuide.md?raw';

type RenderBlock =
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'tip'; tone: 'warning' | 'tip'; title?: string; text: string }
  | { type: 'media'; html: string }
  | { type: 'columns'; items: RenderBlock[][] };

function stripMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function inlineParts(text: string) {
  const parts: Array<{ kind: 'text' | 'code' | 'bold' | 'link'; text: string; href?: string }> = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) parts.push({ kind: 'bold', text: match[2] });
    if (match[3]) parts.push({ kind: 'code', text: match[3] });
    if (match[4]) parts.push({ kind: 'link', text: match[4], href: match[5] });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push({ kind: 'text', text: text.slice(lastIndex) });
  return parts;
}

function renderInline(text: string) {
  return inlineParts(text).map((part, index) => {
    if (part.kind === 'bold') return <strong key={index}>{part.text}</strong>;
    if (part.kind === 'code') {
      return (
        <code key={index} className="rounded bg-[#F4F4F5] px-1.5 py-0.5 text-[0.92em] text-[#3F3F46]">
          {part.text}
        </code>
      );
    }
    if (part.kind === 'link') {
      return (
        <a key={index} href={part.href} target="_blank" rel="noreferrer" className="font-medium text-[#5B4BFF] hover:text-[#3F32C8]">
          {part.text}
        </a>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}

function htmlToMediaNodes(html: string) {
  const nodes: ReactElement[] = [];
  const mediaPattern = /<video[^>]*src="([^"]+)"[^>]*><\/video>|<img[^>]*src="([^"]+)"[^>]*>|!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = mediaPattern.exec(html))) {
    const src = match[1] || match[2] || match[3];
    if (match[1]) {
      nodes.push(
        <video key={`${src}-${index}`} src={src} controls preload="metadata" className="my-3 w-full rounded-lg border border-[#E5E5EA] bg-black" />,
      );
    } else {
      nodes.push(
        <img key={`${src}-${index}`} src={src} alt="教程示例" loading="lazy" className="my-3 max-h-[560px] w-full rounded-lg border border-[#E5E5EA] object-contain" />,
      );
    }
    index += 1;
  }

  const text = stripMarkdown(
    html
      .replace(mediaPattern, '')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&'),
  );

  if (text) {
    nodes.push(
      <p key="caption" className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[#6E6E73]">
        {text}
      </p>,
    );
  }

  return nodes;
}

function splitTableRow(line: string) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function normalizeLine(line: string) {
  return line
    .replace(/<span>\s*/g, '')
    .replace(/\s*<\/span>/g, '')
    .replace(/\\-/g, '-')
    .trimEnd();
}

function parseColumnItems(lines: string[]) {
  const items: string[][] = [];
  let itemLines: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^<columnsItem(\s|>)/.test(trimmed)) {
      itemLines = [];
      continue;
    }
    if (trimmed === '</columnsItem>') {
      if (itemLines) items.push(itemLines);
      itemLines = null;
      continue;
    }
    if (itemLines) itemLines.push(line);
  }

  return items;
}

function parseGuide(markdown: string): RenderBlock[] {
  const lines = markdown.split(/\r?\n/).map(normalizeLine);
  const blocks: RenderBlock[] = [];
  let index = 0;
  let pendingTipTitle: { tone: 'warning' | 'tip'; title: string } | null = null;

  const pushParagraph = (items: string[]) => {
    const text = items.map((line) => line.trim()).filter(Boolean).join('\n');
    if (text) blocks.push({ type: 'paragraph', text });
  };

  while (index < lines.length) {
    const line = lines[index].trim();

    if (line === '<columns>') {
      const columnLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '</columns>') {
        columnLines.push(lines[index]);
        index += 1;
      }
      const items = parseColumnItems(columnLines)
        .map((itemLines) => parseGuide(itemLines.join('\n')))
        .filter((item) => item.length > 0);
      if (items.length > 0) blocks.push({ type: 'columns', items });
      index += 1;
      continue;
    }

    if (!line || /^<span id=/.test(line) || /^<\/?(columns|columnsItem|Tabs|Tab)(\s|>)/.test(line)) {
      index += 1;
      continue;
    }

    const tabTitle = line.match(/^<TabTitle>(.*?)<\/TabTitle>$/);
    if (tabTitle) {
      blocks.push({ type: 'heading', level: 3, text: tabTitle[1], id: `tab-${blocks.length}` });
      index += 1;
      continue;
    }

    const tipMatch = line.match(/^<div data-tips="true" data-tips-type="(warning|tip)"(?: data-tips-is-title="true")?>([\s\S]*?)<\/div>$/);
    if (tipMatch) {
      const tone = tipMatch[1] as 'warning' | 'tip';
      const text = stripMarkdown(tipMatch[2]);
      if (line.includes('data-tips-is-title')) {
        pendingTipTitle = { tone, title: text };
      } else {
        blocks.push({ type: 'tip', tone, title: pendingTipTitle?.title, text });
        pendingTipTitle = null;
      }
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const text = stripMarkdown(heading[2]);
      blocks.push({ type: 'heading', level: heading[1].length, text, id: `section-${blocks.length}` });
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.replace(/```/, '').trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', language, text: codeLines.join('\n') });
      index += 1;
      continue;
    }

    if (line.startsWith('|') && index + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[index + 1].trim())) {
      const rows: string[][] = [splitTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    if (/^(\s*)([-*]|\d+\.)\s+/.test(lines[index])) {
      const ordered = /^\s*\d+\.\s+/.test(lines[index]);
      const items: string[] = [];
      while (index < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^(\s*)([-*]|\d+\.)\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (/<video\b|<img\b|!\[[^\]]*\]\([^)]+\)/.test(line) || /^<div\b/.test(line)) {
      const htmlLines = [line];
      index += 1;
      if (/^<div\b/.test(line) && !line.includes('</div>')) {
        while (index < lines.length && !lines[index].includes('</div>')) {
          htmlLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) {
          htmlLines.push(lines[index]);
          index += 1;
        }
      }
      blocks.push({ type: 'media', html: htmlLines.join('\n') });
      continue;
    }

    if (line === '---') {
      blocks.push({ type: 'paragraph', text: '---' });
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith('```') &&
      !lines[index].trim().startsWith('|') &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[index]) &&
      !/^<span id=/.test(lines[index].trim()) &&
      !/^<\/?(columns|columnsItem|Tabs|Tab)(\s|>)/.test(lines[index].trim()) &&
      !/^<div data-tips/.test(lines[index].trim()) &&
      !/^<div\b/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    pushParagraph(paragraphLines);
  }

  return blocks;
}

const blocks = parseGuide(seedancePromptGuide);
const toc = blocks
  .filter((block): block is Extract<RenderBlock, { type: 'heading' }> => block.type === 'heading' && block.level <= 3)
  .map((heading) => ({ id: heading.id, level: heading.level, text: heading.text }));

const tutorialCategories = [
  {
    title: 'Seedance 2.0',
    description: '提示词、分镜、参考素材与常见问题',
    href: '#seedance-guide',
    status: '已上线',
  },
  {
    title: 'Gemini Veo',
    description: '视频生成提示词教程规划中',
    status: '即将上线',
  },
  {
    title: 'Grok',
    description: '图像与视频创作教程规划中',
    status: '即将上线',
  },
];

function GuideBlock({ block }: { block: RenderBlock }) {
  if (block.type === 'heading') {
    if (block.level === 1) {
      return (
        <h2 id={block.id} className="scroll-mt-24 border-t border-[#E5E5EA] pt-10 text-[28px] font-black leading-tight text-[#1D1D1F]">
          {block.text}
        </h2>
      );
    }
    if (block.level === 2) {
      return (
        <h3 id={block.id} className="scroll-mt-24 pt-6 text-[21px] font-extrabold leading-tight text-[#1D1D1F]">
          {block.text}
        </h3>
      );
    }
    return (
      <h4 id={block.id} className="scroll-mt-24 pt-3 text-[16px] font-bold leading-snug text-[#1D1D1F]">
        {block.text}
      </h4>
    );
  }

  if (block.type === 'paragraph') {
    if (block.text === '---') {
      return <hr className="my-8 border-[#E5E5EA]" />;
    }
    return <p className="whitespace-pre-line text-[15px] leading-8 text-[#3A3A3C]">{renderInline(block.text)}</p>;
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-6 text-[15px] leading-8 text-[#3A3A3C]`}>
        {block.items.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
  }

  if (block.type === 'code') {
    return (
      <pre className="overflow-x-auto rounded-lg border border-[#E5E5EA] bg-[#111113] p-4 text-[13px] leading-6 text-white">
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.type === 'tip') {
    const isWarning = block.tone === 'warning';
    return (
      <aside className={`rounded-lg border p-4 ${isWarning ? 'border-[#F5C26B] bg-[#FFF8E8]' : 'border-[#BFD7FF] bg-[#F1F7FF]'}`}>
        {block.title ? <p className={`mb-1 text-[13px] font-bold ${isWarning ? 'text-[#9A5B00]' : 'text-[#2457A6]'}`}>{block.title}</p> : null}
        <p className="text-[14px] leading-7 text-[#3A3A3C]">{renderInline(block.text)}</p>
      </aside>
    );
  }

  if (block.type === 'table') {
    const [head, ...body] = block.rows;
    return (
      <div className="overflow-x-auto rounded-lg border border-[#E5E5EA]">
        <table className="min-w-full divide-y divide-[#E5E5EA] text-left text-[14px]">
          <thead className="bg-[#F7F8FA]">
            <tr>
              {head.map((cell, index) => (
                <th key={`${cell}-${index}`} className="min-w-[180px] px-4 py-3 font-bold text-[#1D1D1F]">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5EA] bg-white align-top">
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-4 text-[#3A3A3C]">
                    {/<video\b|<img\b|!\[[^\]]*\]\([^)]+\)/.test(cell) ? htmlToMediaNodes(cell) : <span className="leading-7">{renderInline(cell)}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'columns') {
    const columnClass =
      block.items.length >= 4
        ? 'lg:grid-cols-4'
        : block.items.length === 3
          ? 'lg:grid-cols-3'
          : block.items.length === 2
            ? 'lg:grid-cols-2'
            : 'lg:grid-cols-1';

    return (
      <div className={`grid gap-x-10 gap-y-8 md:grid-cols-2 ${columnClass}`}>
        {block.items.map((item, index) => (
          <section key={index} className="min-w-0 border-t border-[#E5E5EA] pt-5">
            <div className="space-y-5">
              {item.map((child, childIndex) => (
                <GuideBlock key={childIndex} block={child} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return <div className="rounded-lg bg-[#F7F8FA] p-4">{htmlToMediaNodes(block.html)}</div>;
}

export function TutorialsPage() {
  return (
    <ShortDramaLayout>
      <main className="bg-[#F7F8FA]">
        <section className="border-b border-[#E5E5EA] bg-white px-6 py-10 lg:px-10">
          <div className="mx-auto max-w-[1880px]">
            <h1 className="text-[34px] font-black leading-tight text-[#1D1D1F] md:text-[44px]">维播Vibeclip使用教程</h1>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {tutorialCategories.map((category) => {
                const isReady = Boolean(category.href);
                const content = (
                  <div
                    className={`h-full rounded-lg border p-5 transition-colors ${
                      isReady
                        ? 'border-[#D8D8DE] bg-white hover:border-[#7B61FF] hover:bg-[#FBFAFF]'
                        : 'border-[#E5E5EA] bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[18px] font-extrabold text-[#1D1D1F]">{category.title}</h2>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                          isReady ? 'bg-[#F0ECFF] text-[#6B4EFF]' : 'bg-[#F2F2F4] text-[#8E8E93]'
                        }`}
                      >
                        {category.status}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] leading-6 text-[#6E6E73]">{category.description}</p>
                  </div>
                );

                return isReady ? (
                  <a key={category.title} href={category.href} className="block">
                    {content}
                  </a>
                ) : (
                  <div key={category.title}>{content}</div>
                );
              })}
            </div>
          </div>
        </section>

        <div id="seedance-guide" className="mx-auto grid max-w-[1880px] gap-8 px-6 py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-10">
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden border-r border-[#E5E5EA] pr-5">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[#AEAEB2]">目录</p>
              <nav className="max-h-[calc(100vh-10rem)] space-y-1 overflow-y-auto pr-1">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`block rounded-md px-2 py-1.5 leading-snug text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#5B4BFF] ${
                      item.level === 1
                        ? 'text-[13px] font-semibold text-[#3A3A3C]'
                        : item.level === 2
                          ? 'ml-3 text-[13px]'
                          : 'ml-6 text-[12.5px]'
                    }`}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="min-w-0 bg-white px-1 py-2 md:px-4 lg:px-8">
            <div className="space-y-6">
              {blocks.map((block, index) => (
                <GuideBlock key={index} block={block} />
              ))}
            </div>
          </article>
        </div>
      </main>
    </ShortDramaLayout>
  );
}
