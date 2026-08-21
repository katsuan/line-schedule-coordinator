/**
 * Flex Messageのツリーを操作する純粋関数群と、送信プレビュー用のテキスト変換。
 * DOM操作は行わない（モーダルUI自体は js/views/previewModal.js の PreviewModal が担当）。
 */
const FlexPreview = (() => {
  function collectText(node) {
    if (!node) return '';
    if (node.type === 'text' || node.type === 'span') {
      if (node.contents) return node.contents.map(collectText).join('');
      return node.text || '';
    }
    if (node.contents) return node.contents.map(collectText).join(' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  const BUTTON_LINE_PREFIX = ' BTN ';
  const TITLE_LINE_PREFIX = ' TTL ';
  const PILL_ROW_PREFIX = ' PILLROW ';
  const CARD_START = ' CARDSTART ';
  const CARD_END = ' CARDEND ';
  const ANSWER_LINE_PREFIX = { '○': ' ANSok ', '△': ' ANSmb ', '×': ' ANSng ' };
  const ANSWER_SYMBOLS = ['○', '△', '×'];

  function answerSymbolOf(label) {
    if (!label) return null;
    return ANSWER_SYMBOLS.find((a) => label.startsWith(a)) || null;
  }

  function isPillGroupBox(node) {
    return node && node.type === 'box' && node.layout === 'horizontal' && Array.isArray(node.contents)
      && node.contents.every((c) => c.type === 'box' && Array.isArray(c.contents) && c.contents[0]);
  }

  function walkPreviewLines(node, lines) {
    if (!node) return;
    if (node.type === 'separator') { lines.push('---'); return; }
    if (node.type === 'text') {
      const text = collectText(node);
      lines.push(node.weight === 'bold' ? TITLE_LINE_PREFIX + text : text);
      return;
    }
    if (node.type === 'button') { lines.push(BUTTON_LINE_PREFIX + node.action.label); return; }
    if (node.type === 'box') {
      if (node.action) { lines.push(BUTTON_LINE_PREFIX + collectText(node)); return; }
      if (node.layout === 'baseline' && node.contents && node.contents[1] && isPillGroupBox(node.contents[1])) {
        const label = node.contents[0] && node.contents[0].text;
        const pills = node.contents[1].contents.map((pillBox) => ({
          text: pillBox.contents[0].text,
          color: pillBox.contents[0].color,
          bg: pillBox.backgroundColor,
        }));
        lines.push(PILL_ROW_PREFIX + JSON.stringify({ label, pills }));
        return;
      }
      if (node.layout === 'horizontal' || node.layout === 'baseline') {
        const line = collectText(node);
        if (!line) return;
        const label = node.contents && node.contents[0] && node.contents[0].text;
        const ans = answerSymbolOf(label);
        const prefix = ans ? ANSWER_LINE_PREFIX[ans] : '';
        lines.push(prefix + line);
      } else if (node.contents) {
        const isCard = !!node.backgroundColor;
        if (isCard) lines.push(CARD_START);
        node.contents.forEach((c) => walkPreviewLines(c, lines));
        if (isCard) lines.push(CARD_END);
      }
    }
  }

  function buildPreviewLines(flex) {
    const lines = [];
    walkPreviewLines(flex.contents.body, lines);
    if (flex.contents.footer) walkPreviewLines(flex.contents.footer, lines);
    return lines;
  }

  const ANSWER_LINE_CLASS = { ' ANSok ': 'choice-ok', ' ANSmb ': 'choice-maybe', ' ANSng ': 'choice-ng' };

  function renderPreviewLinesHtml(lines) {
    return lines.map((l) => {
      if (l === CARD_START) return '<div class="flex-preview-card">';
      if (l === CARD_END) return '</div>';
      if (l === '---') return '<hr class="flex-preview-sep">';
      if (l.startsWith(BUTTON_LINE_PREFIX)) {
        return `<div class="flex-preview-button">${AppUtil.escapeHtml(l.slice(BUTTON_LINE_PREFIX.length))}</div>`;
      }
      if (l.startsWith(TITLE_LINE_PREFIX)) {
        return `<p class="flex-preview-line flex-preview-title">${AppUtil.escapeHtml(l.slice(TITLE_LINE_PREFIX.length))}</p>`;
      }
      if (l.startsWith(PILL_ROW_PREFIX)) {
        const { label, pills } = JSON.parse(l.slice(PILL_ROW_PREFIX.length));
        const pillsHtml = pills.map((p) => `<span class="flex-preview-pill" style="background:${p.bg};color:${p.color}">${AppUtil.escapeHtml(p.text)}</span>`).join('');
        return `<div class="flex-preview-line flex-preview-pill-row"><span class="flex-preview-pill-row-label">${AppUtil.escapeHtml(label)}</span>${pillsHtml}</div>`;
      }
      const ansPrefix = Object.keys(ANSWER_LINE_CLASS).find((p) => l.startsWith(p));
      if (ansPrefix) {
        return `<p class="flex-preview-line flex-preview-answer ${ANSWER_LINE_CLASS[ansPrefix]}">${AppUtil.escapeHtml(l.slice(ansPrefix.length))}</p>`;
      }
      return `<p class="flex-preview-line">${AppUtil.escapeHtml(l)}</p>`;
    }).join('');
  }

  // 参加状況の色（○緑/△黄/×赤）に寄せて、送信ヘッダーの色も同じ配色で揃える。
  const HEADER_COLORS = {
    none: { bg: '#EAF0FE', text: '#4F46E5' }, // 青: 未選択
    0: { bg: '#E9F7EF', text: '#2D8A4E' }, // 緑: 回答ありがとう
    1: { bg: '#FDEDEB', text: '#D93025' }, // 赤: 回答の更新をお願いします
    2: { bg: '#FFF6E5', text: '#C9862B' }, // 黄: イベントが近づいています
  };

  function headerColorFor(presetIndex) {
    return HEADER_COLORS[presetIndex != null ? presetIndex : 'none'];
  }

  function applyComment(flex, comment, presetIndex, presetLabel) {
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    const color = headerColorFor(presetIndex);

    if (bubble.header) {
      if (color) {
        bubble.header.backgroundColor = color.bg;
        (bubble.header.contents || []).forEach((c) => {
          if (c.type === 'text' && !c.contents) c.color = color.text;
        });
      }
      if (presetLabel) {
        bubble.header.contents.push({
          type: 'text', text: presetLabel, size: 'sm', wrap: true, margin: 'sm',
          color: color ? color.text : '#8C8C8C',
        });
      }
      if (comment) {
        bubble.header.contents.push({
          type: 'text', text: comment, size: 'xs', wrap: true, margin: 'xs',
          color: color ? color.text : '#8C8C8C',
        });
      }
      return { altText: flex.altText, contents: bubble };
    }

    if (!comment) return flex;
    bubble.body.contents.push(
      { type: 'separator', margin: 'md' },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        contents: [
          { type: 'text', text: '💬 コメント', size: 'xs', color: '#8C8C8C' },
          { type: 'text', text: comment, size: 'sm', color: '#111111', wrap: true, margin: 'xs' },
        ],
      }
    );
    return { altText: flex.altText, contents: bubble };
  }

  function removeRowsByLabel(node, labels) {
    if (!node || !node.contents) return;
    node.contents = node.contents.filter((child) => {
      const label = child.type === 'box' && child.layout === 'baseline' && child.contents && child.contents[0]
        ? child.contents[0].text : null;
      const ans = answerSymbolOf(label);
      return !(ans && labels.includes(ans));
    });
    node.contents.forEach((child) => removeRowsByLabel(child, labels));
  }

  function filterGroups(flex, unselectedAnswers) {
    if (!unselectedAnswers || !unselectedAnswers.length) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    removeRowsByLabel(bubble.body, unselectedAnswers);
    return { altText: flex.altText, contents: bubble };
  }

  function mergeHiddenRows(node, hiddenAnswers) {
    if (!node || !node.contents) return;
    const idxs = [];
    node.contents.forEach((child, i) => {
      const label = child.type === 'box' && child.layout === 'baseline' && child.contents && child.contents[0]
        ? child.contents[0].text : null;
      const ans = answerSymbolOf(label);
      if (ans && hiddenAnswers.includes(ans)) idxs.push(i);
    });
    if (idxs.length) {
      const pills = idxs.map((i) => {
        const row = node.contents[i];
        const label = row.contents[0].text;
        const color = row.contents[0].color;
        return {
          type: 'box',
          layout: 'vertical',
          backgroundColor: row.backgroundColor,
          cornerRadius: 'md',
          paddingAll: 'xs',
          contents: [{ type: 'text', text: label, size: 'xs', weight: 'bold', color, align: 'center' }],
        };
      });
      const combinedRow = {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '対象', size: 'sm', color: '#8C8C8C', flex: 2 },
          { type: 'box', layout: 'horizontal', flex: 5, spacing: 'xs', contents: pills },
        ],
      };
      node.contents[idxs[0]] = combinedRow;
      idxs.slice(1).reverse().forEach((i) => node.contents.splice(i, 1));
      return;
    }
    node.contents.forEach((child) => mergeHiddenRows(child, hiddenAnswers));
  }

  // 名前を隠しているときは「敬称略」の注記が意味を持たないため取り除く。
  function stripHonorificNote(node) {
    if (!node) return;
    if (node.type === 'text' && typeof node.text === 'string' && node.text.indexOf('敬称略') >= 0) {
      node.text = node.text.replace('敬称略・', '').replace('敬称略', '');
    }
    if (node.contents) node.contents.forEach(stripHonorificNote);
  }

  function hideNames(flex, hiddenAnswers) {
    if (!hiddenAnswers || !hiddenAnswers.length) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    mergeHiddenRows(bubble.body, hiddenAnswers);
    stripHonorificNote(bubble.body);
    return { altText: flex.altText, contents: bubble };
  }

  return {
    buildPreviewLines, renderPreviewLinesHtml,
    headerColorFor, applyComment, filterGroups, hideNames,
  };
})();
