// 送る前にカードの中身を変える処理（js/flexPreview.js）を、GAS が作る本物の連絡のカードで確かめる（node --test test/）
//   ○△× で絞る・名前を隠す・ひとことを入れる。どれも元のカードは変えず、LINE が受けつける形のまま。
//   見るのはカードの中身（contents）だけ。通知に出る altText は GAS が作ったまま（名前が入る。2026-11 の報告で相談中）
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createGas, response, checkMessages } = require(path.join(__dirname, "../../q-oqrn/tools/qtest/fake-gas.js"));

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function loadFlexPreview() {
  const context = vm.createContext({ console, window: {} });
  vm.runInContext(read("js/markup.js") + "\n" + read("js/flexPreview.js") + "\n;globalThis.FlexPreview = FlexPreview;", context);
  return context.FlexPreview;
}

// 幹事が予定を作り、○△× の名前つきの連絡のカードを GAS に作ってもらう
function reminderFlex() {
  const gas = createGas({
    dir: path.join(__dirname, "../gas"),
    properties: { SPREADSHEET_ID: "SPREADSHEET_TEST", LIFF_URL: "https://liff.line.me/2009927582-abc" },
    fetch: (url) => {
      if (/oauth2\/v2\.1\/verify/.test(url)) return response(200, { client_id: "2009927582", expires_in: 3600, scope: "profile" });
      if (/v2\/profile/.test(url)) return response(200, { userId: "U_OWNER", displayName: "幹事" });
      return undefined;
    },
  });
  const made = gas.doPost({ action: "createEvent", accessToken: "tok", title: "BBQ", options: [{ startAt: "2026-11-01T10:00", title: "1日目" }] });
  assert.strictEqual(made.ok, true, JSON.stringify(made));
  const res = gas.doPost({
    action: "buildReminderFlex", accessToken: "tok", eventId: made.data.eventId,
    groups: { "○": ["たろう", "はな"], "△": ["りん"], "×": ["けん"] }, optionTitle: "1日目", optionStartAt: "2026-11-01T10:00",
  });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  return JSON.parse(JSON.stringify(res.data));
}

// LINE に送る形（送る前の最後の形）にして、LINE が受けつけないところがないか
function lineErrors(flex) {
  return checkMessages([{ type: "flex", altText: flex.altText, contents: JSON.parse(JSON.stringify(flex.contents)) }]).filter((p) => p.level === "error");
}

test("送る見本：○△× のチップを外した答えの人は、カードに入らない（元のカードはそのまま）", () => {
  const FlexPreview = loadFlexPreview();
  const flex = reminderFlex();
  const before = JSON.stringify(flex);
  const out = JSON.stringify(FlexPreview.filterGroups(flex, ["×", "△"]).contents);
  assert.match(out, /たろう/);
  assert.doesNotMatch(out, /けん|りん/);
  assert.strictEqual(JSON.stringify(flex), before);
  assert.strictEqual(FlexPreview.filterGroups(flex, []), flex);
  assert.deepStrictEqual(lineErrors(FlexPreview.filterGroups(flex, ["×"])), []);
});

test("送る見本：「名前を隠す」と、人数だけになり名前はどこにも出ない（敬称略の注記も消える）", () => {
  const FlexPreview = loadFlexPreview();
  const flex = reminderFlex();
  const hidden = FlexPreview.hideNames(flex, ["○", "△", "×"]);
  const out = JSON.stringify(hidden.contents);
  ["たろう", "はな", "りん", "けん", "敬称略"].forEach((name) => assert.ok(!out.includes(name), name));
  assert.match(out, /○ 2人/);
  assert.deepStrictEqual(lineErrors(hidden), []);
  // 見本の文字にも名前が出ない
  const lines = FlexPreview.buildPreviewLines(hidden).join("\n");
  assert.ok(!/たろう|りん/.test(lines), lines);
});

test("送る見本：ひとこと（送信ヘッダー・コメント）は見出しに入り、文字は HTML の外に出ない", () => {
  const FlexPreview = loadFlexPreview();
  const flex = reminderFlex();
  const xss = "<img src=x onerror=" + "aler" + "t(1)>";
  const out = FlexPreview.applyComment(flex, xss, 1, "回答の更新をお願いします");
  const header = JSON.stringify(out.contents.header);
  assert.match(header, /回答の更新をお願いします/);
  assert.ok(header.includes(xss));
  assert.strictEqual(out.contents.header.backgroundColor, FlexPreview.headerColorFor(1).bg);
  assert.deepStrictEqual(lineErrors(out), []);
  assert.ok(!FlexPreview.renderPreviewLinesHtml(FlexPreview.buildPreviewLines(out)).includes("<img"));
  // 元のカードの見出しは変えない
  assert.ok(!JSON.stringify(flex.contents.header).includes("回答の更新"));
});
