/**
 * カード（Flex）の中身を変える・読む（画面には触らない）：送る前の見本の文字にする、ひとことを入れる、名前を隠す、○△× で絞る。
 * 呼ばれ方：views/previewModal.js（見本）と share.js（送る前に同じ変換をかける）から。node のテストでも動く。
 */
const FlexPreview = (() => {
  // 箱の中の文字を全部つないで返す
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

  // 「○ 3人」のようなラベルの先頭の ○△×。なければ null
  function answerSymbolOf(label) {
    if (!label) return null;
    return ANSWER_SYMBOLS.find((a) => label.startsWith(a)) || null;
  }

  // ○△× の札が横に並んだ箱か
  function isPillGroupBox(node) {
    return node && node.type === 'box' && node.layout === 'horizontal' && Array.isArray(node.contents)
      && node.contents.every((c) => c.type === 'box' && Array.isArray(c.contents) && c.contents[0]);
  }

  // カードの箱をたどって、見本の1行ずつ（ボタン・題・答えの行にしるし）を lines に足す
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

  // カードを、見本に出す行の並びにする
  function buildPreviewLines(flex) {
    const lines = [];
    walkPreviewLines(flex.contents.body, lines);
    if (flex.contents.footer) walkPreviewLines(flex.contents.footer, lines);
    return lines;
  }

  const ANSWER_LINE_CLASS = { ' ANSok ': 'choice-ok', ' ANSmb ': 'choice-maybe', ' ANSng ': 'choice-ng' };

  // 見本の行の並びを HTML にする
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
    none: { bg: '#E0F2FE', text: '#0284C7' }, // 青: 未選択
    0: { bg: '#E9F7EF', text: '#2D8A4E' }, // 緑: 回答ありがとう
    1: { bg: '#FDEDEB', text: '#D93025' }, // 赤: 回答の更新をお願いします
    2: { bg: '#FFF6E5', text: '#C9862B' }, // 黄: イベントが近づいています
  };

  // ひとことの見本（何番目か）に合う見出しの色
  function headerColorFor(presetIndex) {
    return HEADER_COLORS[presetIndex != null ? presetIndex : 'none'];
  }

  // カードの見出しにひとことを入れる（見本の色も付ける）。元のカードは変えずに新しく返す
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

  // ○△× の行のうち、送らないものを消す
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

  // 選ばなかった答え（○△×）の行を外したカードを返す
  function filterGroups(flex, unselectedAnswers) {
    if (!unselectedAnswers || !unselectedAnswers.length) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    removeRowsByLabel(bubble.body, unselectedAnswers);
    return { altText: flex.altText, contents: bubble };
  }

  // 名前を隠す答えの行を「○ 3人」のように人数だけにする
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

  // 実名（○2人 のような回答者名の行）が残っているかどうか。
  // 人数のみの「対象」ピル行（mergeHiddenRows後）は実名ではないためカウントしない。
  function hasVisibleNames_(node) {
    if (!node) return false;
    if (node.type === 'box' && node.layout === 'baseline' && node.contents && node.contents[0]) {
      if (answerSymbolOf(node.contents[0].text)) return true;
    }
    if (node.contents) return node.contents.some(hasVisibleNames_);
    return false;
  }

  // 名前を隠したカードを返す（人数だけ）
  function hideNames(flex, hiddenAnswers) {
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    if (hiddenAnswers && hiddenAnswers.length) {
      mergeHiddenRows(bubble.body, hiddenAnswers);
    }
    // 名前を隠した、または回答者グループが絞り込まれて実名が1件も残っていない場合は
    // 「敬称略」の注記自体が意味を持たないため取り除く。
    if (!hasVisibleNames_(bubble.body)) {
      stripHonorificNote(bubble.body);
    }
    return { altText: flex.altText, contents: bubble };
  }

  return {
    buildPreviewLines, renderPreviewLinesHtml,
    headerColorFor, applyComment, filterGroups, hideNames,
  };
})();
