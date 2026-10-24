// 画面の、DOM に触らない部分（文字を HTML に入れる・URL を読む）を確かめる（node --test test/）
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(file, name, search) {
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: search || "", href: "https://katsuan.github.io/q-qurukana/" + (search || "") } } });
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  vm.runInContext(code + `\n;globalThis.${name} = ${name};`, context, { filename: file });
  return context[name];
}

// 試す文字（コードを調べる道具が、本物の小窓と見まちがえないように分けて書く）
const ALERT = "aler" + "t(1)";
const XSS = `<img src=x onerror=${ALERT}>`;

test("アイコン：画像は https だけ。名前・URL の文字が HTML の外に出ない", () => {
  const AppUtil = load("js/util.js", "AppUtil");
  const ok = AppUtil.avatarHtml("たろう", "https://profile.line-scdn.net/0habc");
  assert.match(ok, /background-image:url\('https:\/\/profile\.line-scdn\.net\/0habc'\)/);
  [
    "javascript:" + ALERT,
    "http://example.com/a.png",
    'https://a.example/x" onmouseover="' + ALERT,
    "https://a.example/x') ; background:url('https://evil.example",
    "https://a.example/x\"><script>" + ALERT + "</script>",
    XSS,
  ].forEach((url) => {
    const html = AppUtil.avatarHtml(XSS, url);
    assert.ok(!/<img|<script|onmouseover="|"\s*>[^<]*<\/script/i.test(html), html);
    assert.strictEqual((html.match(/"/g) || []).length % 2, 0, html);
    assert.ok(!/url\('[^']*'[^)]/.test(html), html);
  });
  assert.strictEqual(AppUtil.avatarHtml(XSS, ""), '<span class="avatar">&lt;</span>');
});

test("タイトル：絵文字のあとの文字も esc する", () => {
  const AppUtil = load("js/util.js", "AppUtil");
  assert.ok(!AppUtil.titleIconHtml("🎉" + XSS).includes("<img"));
  assert.ok(!AppUtil.titleIconHtml(XSS).includes("<img"));
  assert.ok(!AppUtil.calendarLinkHtml(XSS, XSS, "2026-11-01T10:00", "", XSS).includes("<img"));
});

test("サーバーのエラーは、種類だけ見てやさしい言葉に", () => {
  const AppUtil = load("js/util.js", "AppUtil");
  assert.match(AppUtil.friendlyReason(new Error("タイトルが長すぎます（100字まで）")), /短く/);
  assert.match(AppUtil.friendlyReason(new Error("編集者になるには、作成者からの招待のリンクが必要です")), /編集を依頼/);
  assert.ok(!AppUtil.friendlyReason(new Error("Exception: " + XSS)).includes("<"));
});

test("URL の中身：形と長さが合わないものは使わない", () => {
  const q = (search) => load("js/router.js", "AppRouter", search).getQueryState();
  const good = q("?event=EVT_1234-abcd&claimEditor=1&key=Ab_-9&approveEditor=1&requesterId=p_abc&requesterName=%E3%81%9F%E3%82%8D%E3%81%86&requesterPic=https%3A%2F%2Fprofile.line-scdn.net%2Fx");
  assert.strictEqual(good.eventId, "EVT_1234-abcd");
  assert.strictEqual(good.inviteKey, "Ab_-9");
  assert.strictEqual(good.requesterName, "たろう");
  assert.strictEqual(good.requesterPic, "https://profile.line-scdn.net/x");
  const bad = q("?view=" + encodeURIComponent(XSS) + "&event=" + encodeURIComponent(XSS) + "&key=" + encodeURIComponent("a b") +
    "&requesterId=" + encodeURIComponent("../x") + "&requesterPic=" + encodeURIComponent("javascript:" + ALERT) +
    "&requesterName=" + encodeURIComponent("x".repeat(61)));
  assert.deepStrictEqual([bad.view, bad.eventId, bad.inviteKey, bad.requesterId, bad.requesterPic, bad.requesterName], ["", "", "", "", "", ""]);
});

test("カレンダー：週のはじまり（日曜が既定、月曜にも）でマスと見出しがずれる", () => {
  const store = new Map();
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "", href: "" }, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/util.js"), "utf8") + "\n;globalThis.AppUtil = AppUtil;", context);
  const AppUtil = context.AppUtil;
  assert.strictEqual(AppUtil.getWeekStart(), 0);
  // 2026年10月1日は木曜
  assert.strictEqual(AppUtil.monthCells(2026, 9, 0).indexOf(1), 4);
  assert.strictEqual(AppUtil.monthCells(2026, 9, 1).indexOf(1), 3);
  assert.strictEqual(AppUtil.monthCells(2026, 9, 1).length % 7, 0);
  assert.strictEqual(AppUtil.weekHeader(1).map((w) => w.label).join(""), "月火水木金土日");
  AppUtil.setWeekStart(1);
  assert.strictEqual(AppUtil.getWeekStart(), 1);
});

test("「許可する」のカードがあとで押されても、いまの状態に合わせる", () => {
  const DetailHeader = load("js/views/detailHeader.js", "DetailHeader");
  const data = { isCreator: true, editors: [{ userId: "p_already" }] };
  assert.strictEqual(DetailHeader.approveState({ approveEditor: true, requesterId: "p_new" }, data), "pending");
  assert.strictEqual(DetailHeader.approveState({ approveEditor: true, requesterId: "p_already" }, data), "already");
  assert.strictEqual(DetailHeader.approveState({ approveEditor: true, requesterId: "p_new" }, { isCreator: false, editors: [] }), "not-creator");
  assert.strictEqual(DetailHeader.approveState({ approveEditor: true, requesterId: "" }, data), "invalid");
  assert.strictEqual(DetailHeader.approveState({ approveEditor: false }, data), "");
});

test("○△× の保存に失敗したら、押す前の答えの印に戻す", async () => {
  // ボタン3つだけのにせものの箱
  function fakeChoices(selected) {
    const buttons = ["○", "△", "×"].map((value) => {
      const classes = new Set(value === selected ? ["choice-btn", "selected"] : ["choice-btn"]);
      return { dataset: { value }, disabled: false, classList: { contains: (c) => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
    });
    return { buttons, querySelectorAll: () => buttons, selected: () => buttons.filter((b) => b.classList.contains("selected")).map((b) => b.dataset.value) };
  }
  const notices = [];
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "" } },
    AppUtil: { notifyError: (m) => notices.push(m), beginButtonLoading: () => () => {}, escapeHtml: String } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/views/optionCard.js"), "utf8") + "\n;globalThis.OptionCard = OptionCard;", context);
  const { OptionCard } = context;

  const box = fakeChoices("○");
  const ok = await OptionCard.saveChoice(box, box.buttons[2], () => Promise.reject(new Error("x")));
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(box.selected(), ["○"]);
  assert.ok(box.buttons.every((b) => !b.disabled));
  assert.strictEqual(notices.length, 1);

  const box2 = fakeChoices("");
  assert.strictEqual(await OptionCard.saveChoice(box2, box2.buttons[1], () => Promise.resolve()), true);
  assert.deepStrictEqual(box2.selected(), ["△"]);
});

test("通信が途中で切れたとき、作る・足す操作は自動でやりなおさない（2つできてしまうため）", async () => {
  function run(action, firstError) {
    const calls = [];
    const context = vm.createContext({ URL, URLSearchParams, console: { warn() {} }, window: {},
      AppConfig: { load: async () => ({ gasUrl: "https://script.google.com/macros/s/x/exec" }) },
      AppPlatform: { getAccessToken: () => "tok" },
      fetch: async (url, opt) => {
        calls.push(JSON.parse(opt.body).action);
        if (calls.length === 1) throw new TypeError(firstError);
        return { json: async () => ({ ok: true, data: {} }) };
      } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/api.js"), "utf8") + "\n;globalThis.AppApi = AppApi;", context);
    return context.AppApi[action]({}).then(() => calls.length, () => calls.length);
  }
  assert.strictEqual(await run("createEvent", "Failed to fetch"), 1);
  assert.strictEqual(await run("addOptions", "Failed to fetch"), 1);
  assert.strictEqual(await run("addComment", "Failed to fetch"), 1);
  // 同じ答えを送りなおしても変わらない操作・読むだけの操作は、1回だけやりなおす
  assert.strictEqual(await run("submitAnswer", "Failed to fetch"), 2);
  assert.strictEqual(await run("getSummary", "Failed to fetch"), 2);
  // GAS に届いていない（GET として届いた）ときは、作る操作もやりなおしてよい
  assert.strictEqual(await run("createEvent", "GET は未対応です"), 2);
});

test("季節の絵文字：QSeason があれば付ける・なければそのまま", () => {
  const AppUtil = load("js/util.js", "AppUtil");
  assert.strictEqual(AppUtil.withSeason("送りました"), "送りました");
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "" }, QSeason: { decorate: (t) => t + " 🎃" } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/util.js"), "utf8") + "\n;globalThis.AppUtil = AppUtil;", context);
  assert.strictEqual(context.AppUtil.withSeason("送りました"), "送りました 🎃");
});
