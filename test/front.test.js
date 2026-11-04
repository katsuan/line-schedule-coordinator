// 画面の、DOM に触らない部分（文字を HTML に入れる・URL を読む）を確かめる（node --test test/）
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// AppUtil は3つのファイルに分けて持つ（js/markup.js・js/dates.js・js/notice.js）
const UTIL_FILES = ["js/markup.js", "js/dates.js", "js/notice.js"];
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const utilCode = () => UTIL_FILES.map(read).join("\n");

function load(file, name, search) {
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: search || "", href: "https://katsuan.github.io/q-qurukana/" + (search || "") } } });
  const code = file === "AppUtil" ? utilCode() : read(file);
  vm.runInContext(code + `\n;globalThis.${name} = ${name};`, context, { filename: file });
  return context[name];
}

// 試す文字（コードを調べる道具が、本物の小窓と見まちがえないように分けて書く）
const ALERT = "aler" + "t(1)";
const XSS = `<img src=x onerror=${ALERT}>`;

test("アイコン：画像は https だけ。名前・URL の文字が HTML の外に出ない", () => {
  const AppUtil = load("AppUtil", "AppUtil");
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
  const AppUtil = load("AppUtil", "AppUtil");
  assert.ok(!AppUtil.titleIconHtml("🎉" + XSS).includes("<img"));
  assert.ok(!AppUtil.titleIconHtml(XSS).includes("<img"));
  assert.ok(!AppUtil.calendarLinkHtml(XSS, XSS, "2026-11-01T10:00", "", XSS).includes("<img"));
});

test("サーバーのエラーは、種類だけ見てやさしい言葉に", () => {
  const AppUtil = load("AppUtil", "AppUtil");
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

function utilWithStore(initial, kit) {
  const store = new Map(Object.entries(initial || {}));
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "", href: "" }, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }, QWeekStart: kit } });
  vm.runInContext(utilCode() + "\n;globalThis.AppUtil = AppUtil;", context);
  return { AppUtil: context.AppUtil, store };
}

test("カレンダー：週のはじまり（月曜が既定、日曜にも）でマスと見出しがずれる", () => {
  const { AppUtil, store } = utilWithStore();
  assert.strictEqual(AppUtil.getWeekStart(), 1);
  // 2026年10月1日は木曜
  assert.strictEqual(AppUtil.monthCells(2026, 9, 0).indexOf(1), 4);
  assert.strictEqual(AppUtil.monthCells(2026, 9, 1).indexOf(1), 3);
  assert.strictEqual(AppUtil.monthCells(2026, 9, 1).length % 7, 0);
  assert.strictEqual(AppUtil.weekHeader(1).map((w) => w.label).join(""), "月火水木金土日");
  AppUtil.setWeekStart(0);
  assert.strictEqual(AppUtil.getWeekStart(), 0);
  // 選んだ値は、Q のツールで共通のキーに残す
  assert.strictEqual(store.get("qlove:weekStart"), "0");
});

test("週のはじまり：Q 共通の設定 → 前にくるかなで選んだ値 → 月曜、の順に読む", () => {
  assert.strictEqual(utilWithStore({ "qlove:weekStart": "0" }).AppUtil.getWeekStart(), 0);
  assert.strictEqual(utilWithStore({ "qlove:weekStart": "1", "qurukana:weekStart": "0" }).AppUtil.getWeekStart(), 1);
  // 前の版で「日曜」を選んだ人は、そのまま日曜
  assert.strictEqual(utilWithStore({ "qurukana:weekStart": "0" }).AppUtil.getWeekStart(), 0);
  assert.strictEqual(utilWithStore({ "qlove:weekStart": "x" }).AppUtil.getWeekStart(), 1);
});

test("週のはじまり：Q キットの部品（QWeekStart）が読めたら、それに前のくるかなの値を渡して使う", () => {
  const calls = [];
  const kit = { get: (fallback) => (calls.push(["get", fallback]), 0), set: (v) => calls.push(["set", v]) };
  const { AppUtil } = utilWithStore({ "qurukana:weekStart": "0" }, kit);
  assert.strictEqual(AppUtil.getWeekStart(), 0);
  AppUtil.setWeekStart(1);
  assert.deepStrictEqual(calls, [["get", 0], ["set", 1]]);
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
  const AppUtil = load("AppUtil", "AppUtil");
  assert.strictEqual(AppUtil.withSeason("送りました"), "送りました");
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "" }, QSeason: { decorate: (t) => t + " 🎃" } } });
  vm.runInContext(utilCode() + "\n;globalThis.AppUtil = AppUtil;", context);
  assert.strictEqual(context.AppUtil.withSeason("送りました"), "送りました 🎃");
});

test("編集を許可したお知らせは、予定を開くボタンつきのカード（LINE が受けつける形・ボタンは画面を開くだけ）", async () => {
  const { checkMessages } = require(path.join(__dirname, "../../q-oqrn/tools/qtest/fake-gas.js"));
  const sent = [];
  const liff = {
    isApiAvailable: () => true, isInClient: () => false,
    permission: { query: async () => ({ state: "granted" }) },
    sendMessages: async (m) => { sent.push(m); },
    shareTargetPicker: async (m) => { sent.push(m); return { status: "success" }; },
  };
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "" }, liff }, liff,
    AppConfig: { load: async () => ({ liffId: "2009927582-abc" }) }, AppUtil: { ask() {} }, PreviewModal: {}, FlexPreview: {} });
  vm.runInContext(read("js/cards.js") + "\n" + read("js/share.js") + "\n;globalThis.AppShare = AppShare;", context);
  const ok = await context.AppShare.sendApprovedCard("EVT_1", "🍖 BBQ", "たろう");
  assert.strictEqual(ok, true);
  const messages = JSON.parse(JSON.stringify(sent[0]));
  assert.strictEqual(messages[0].type, "flex");
  assert.match(messages[0].altText, /BBQ/);
  assert.deepStrictEqual(checkMessages(messages).filter((p) => p.level === "error"), []);
  const actions = JSON.stringify(messages).match(/"action":\{[^}]*\}/g) || [];
  assert.strictEqual(actions.length, 1);
  assert.match(actions[0], /"type":"uri".*event=EVT_1/);
});

test("画面の AppApi と GAS の routeAction_ は、同じ action をそろえて持つ", () => {
  const context = vm.createContext({ URL, URLSearchParams, console, window: {} });
  vm.runInContext(read("js/api.js") + "\n;globalThis.AppApi = AppApi;", context);
  const front = Object.keys(context.AppApi).sort();
  const routing = read("gas/03_routing.js");
  const gas = [...routing.matchAll(/case '(\w+)':/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(front, gas);
});

test("使い方の文は、実際の確かめの窓のボタン（「知らせる」）と同じ言葉", () => {
  const guide = read("js/views/guide.js");
  const card = read("js/views/optionCard.js");
  assert.match(card, /title: '変更を回答者に知らせますか？'[^\n]*ok: '知らせる'/);
  assert.match(guide, /「変更を回答者に知らせますか？」/);
  assert.match(guide, /「知らせる」を選ぶと/);
  assert.doesNotMatch(guide, /「はい」を選ぶと/);
});

test("スマホの幅では、開始・完了の日時の欄を縦に並べる（iPhone で日時が切れない）", () => {
  assert.match(read("style.css"), /@media \(max-width: 430px\)[\s\S]*\.option-range \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("「LINE 版で開く」は Q キットと同じ 📱", () => {
  ["js/platform.js", "js/views/previewModal.js"].forEach((file) => {
    assert.match(read(file), /📱 LINE 版で開く/, file);
    assert.doesNotMatch(read(file), /💬 LINE 版で開く/, file);
  });
});

test("案内の文が指すボタン・欄の名前は、画面に同じ名前である", () => {
  const tips = read("js/markup.js");
  const guide = read("js/views/guide.js");
  const detail = read("js/views/detail.js");
  const list = read("js/views/list.js");
  // 「イベントを追加」は予定の画面のたたみ欄（頭は線アイコン。案内の文には印を書かない）
  assert.match(tips, /「イベントを追加」/);
  assert.match(detail, /icon\('add', 'ls-fold-icon'\)\}イベントを追加<\/summary>/);
  // 「カードでおくるん」「カレンダー」「新規作成」
  assert.match(detail, /is-oqrn" type="button">カードでおくるん<\/button>/);
  assert.match(list, /icon\('calendar'\)\}カレンダー<\/a>/);
  assert.match(list, /icon\('add'\)\}新規作成<\/a>/);
  assert.doesNotMatch(guide + tips + list, /「＋ |「🗓️ |「💬 /);
  // 送る前のシートは「送る内容の見本」
  assert.match(read("js/views/previewModal.js"), /title: '送る内容の見本'/);
  assert.match(guide, /送る内容の見本/);
  assert.doesNotMatch(guide + tips, /プレビューを確認/);
  // 前の名前を案内しない
  assert.doesNotMatch(guide + tips + list + detail, /LINEで送る|LINE送信|LINEで共有/);
});

test("開始を入れたとき、完了が空か開始より前なら、開始の1時間後を入れる（入っている完了はそのまま）", () => {
  const AppUtil = load("AppUtil", "AppUtil");
  assert.strictEqual(AppUtil.suggestEndAt("2026-11-01T10:00", ""), "2026-11-01T11:00");
  assert.strictEqual(AppUtil.suggestEndAt("2026-11-01T23:30", ""), "2026-11-02T00:30"); // 日をまたぐ
  assert.strictEqual(AppUtil.suggestEndAt("2026-11-01T10:00", "2026-11-01T09:00"), "2026-11-01T11:00");
  assert.strictEqual(AppUtil.suggestEndAt("2026-11-01T10:00", "2026-11-01T15:00"), null);
  assert.strictEqual(AppUtil.suggestEndAt("", ""), null);
  assert.strictEqual(AppUtil.suggestEndAt("x", ""), null);
});

test("キーボード：押せる印（onActivate）は、クリックと Enter・スペースで動く（ほかのキーでは動かない）", () => {
  const AppUtil = load("AppUtil", "AppUtil");
  const listeners = {};
  const el = { addEventListener: (type, fn) => { listeners[type] = fn; } };
  let count = 0;
  AppUtil.onActivate(el, () => { count += 1; });
  listeners.click({});
  let prevented = 0;
  const key = (k) => listeners.keydown({ key: k, preventDefault: () => { prevented += 1; } });
  key("Enter"); key(" "); key("a");
  assert.strictEqual(count, 3);
  assert.strictEqual(prevented, 2);
});

test("紹介・編集の依頼のカード：LINE が受けつける形、ボタンは画面を開くだけ。依頼のリンクに本物の userId は入らない", () => {
  const { checkMessages } = require(path.join(__dirname, "../../q-oqrn/tools/qtest/fake-gas.js"));
  const AppCards = load("js/cards.js", "AppCards");
  const intro = AppCards.appIntro("2009927582-abc");
  const request = AppCards.editRequest("2009927582-abc", "EVT_1", "🍖 BBQ",
    { userId: "p_ab12", displayName: "た&ろう", pictureUrl: "https://profile.line-scdn.net/x" }, { displayName: "はな" });
  [intro, request].forEach((card) => {
    const messages = JSON.parse(JSON.stringify([{ type: "flex", altText: card.altText, contents: card.contents }]));
    assert.deepStrictEqual(checkMessages(messages).filter((p) => p.level === "error"), []);
    const actions = JSON.stringify(messages).match(/"action":\{[^}]*\}/g) || [];
    assert.strictEqual(actions.length, 1);
    assert.match(actions[0], /"type":"uri"/);
  });
  const uri = request.contents.footer.contents[0].action.uri;
  const params = new URL(uri).searchParams;
  assert.strictEqual(params.get("event"), "EVT_1");
  assert.strictEqual(params.get("approveEditor"), "1");
  assert.strictEqual(params.get("requesterId"), "p_ab12");
  assert.strictEqual(params.get("requesterName"), "た&ろう");
  assert.doesNotMatch(uri, /U[0-9a-f]{32}/);
  // LIFF の ID がないときは、ボタンなしのカード（押しても開けないボタンを出さない）
  assert.strictEqual(AppCards.appIntro("").contents.footer, undefined);
  assert.strictEqual(AppCards.approved("", "EVT_1", "t", "x").contents.footer, undefined);
});

test("一覧のタブ：未回答（終わった予定は出さない）・回答済み・自分が作成。はじめは予定のある最初のタブ", () => {
  const ListView = load("js/views/list.js", "ListView");
  const events = [
    { eventId: "A", isCreator: false, hasAnswered: false, isPast: false },
    { eventId: "B", isCreator: false, hasAnswered: false, isPast: true },
    { eventId: "C", isCreator: false, hasAnswered: true },
    { eventId: "D", isCreator: true, hasAnswered: true },
  ];
  const ids = (r) => Object.fromEntries(r.tabs.map((t) => [t.key, t.list.map((e) => e.eventId).join("")]));
  const r = ListView.groupEvents(events);
  assert.deepStrictEqual(ids(r), { unanswered: "A", answered: "C", created: "D" });
  assert.strictEqual(r.defaultTab, "unanswered");
  assert.strictEqual(ListView.groupEvents(events.slice(2)).defaultTab, "answered");
  assert.strictEqual(ListView.groupEvents([events[3]]).defaultTab, "created");
  assert.strictEqual(ListView.groupEvents([]).defaultTab, "unanswered");
});

test("予定を作る：空のイベントは数えない、一部だけ入れたイベントは知らせて止める", () => {
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "" } } });
  vm.runInContext(utilCode() + "\n" + read("js/views/create.js") + "\n;globalThis.CreateView = CreateView;", context);
  const { CreateView } = context;
  const blank = { title: "", startAt: "", endAt: "", location: "" };
  const full = { title: "BBQ", startAt: "2026-11-01T10:00", endAt: "2026-11-01T12:00", location: "" };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(CreateView.pickOptions("8月", [full, blank]))), { options: [full] });
  assert.match(CreateView.pickOptions("", [full]).error, /タイトル/);
  assert.match(CreateView.pickOptions("8月", [blank]).error, /1件以上/);
  assert.match(CreateView.pickOptions("8月", [full, { ...blank, location: "公園" }]).error, /タイトル・開始・完了/);
  assert.match(CreateView.pickOptions("8月", [{ ...full, endAt: "2026-11-01T09:00" }]).error, /完了は開始より後/);
});

test("日付の見せ方：同じ日なら終わりは時刻だけ、7日以内は「今日・明日・○日後」の札", () => {
  const AppUtil = load("AppUtil", "AppUtil");
  assert.strictEqual(AppUtil.formatDateRange("2026-11-01T10:00", "2026-11-01T12:30"), "2026/11/01 10:00 〜 12:30");
  assert.strictEqual(AppUtil.formatDateRange("2026-11-01T22:00", "2026-11-02T01:00"), "2026/11/01 22:00 〜 2026/11/02 01:00");
  assert.strictEqual(AppUtil.formatDateRange("2026-11-01T10:00", ""), "2026/11/01 10:00");
  assert.strictEqual(AppUtil.formatDateRange("", ""), "");
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d.toISOString(); };
  assert.match(AppUtil.relativeDayPillHtml(day(0)), /date-pill-urgent">今日</);
  assert.match(AppUtil.relativeDayPillHtml(day(1)), /date-pill-urgent">明日</);
  assert.match(AppUtil.relativeDayPillHtml(day(3)), /class="date-pill">3日後</);
  assert.strictEqual(AppUtil.relativeDayPillHtml(day(8)), "");
  assert.strictEqual(AppUtil.relativeDayPillHtml(day(-1)), "");
});

test("カレンダー追加：Google カレンダーの画面を開くリンク（終わりがなければ1時間）", () => {
  const AppUtil = load("AppUtil", "AppUtil");
  const href = (html) => new URL(html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, "&"));
  const url = href(AppUtil.calendarLinkHtml("BBQ", "", "2026-11-01T10:00", "", "河原"));
  assert.strictEqual(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.strictEqual(url.searchParams.get("text"), "BBQ");
  assert.strictEqual(url.searchParams.get("dates"), "20261101T100000/20261101T110000");
  assert.strictEqual(url.searchParams.get("location"), "河原");
  assert.match(AppUtil.calendarLinkHtml("BBQ", "", "2026-11-01T10:00", "", ""), /target="_blank" rel="noopener"/);
  assert.strictEqual(AppUtil.calendarLinkHtml("BBQ", "", "", "", ""), "");
});

test("題の頭の絵文字：あればそれを、なければ 🗓️（カレンダーの札と題の見出しで同じ決まり）", () => {
  const AppUtil = load("AppUtil", "AppUtil");
  assert.strictEqual(AppUtil.extractIcon("🍖 BBQ"), "🍖");
  assert.strictEqual(AppUtil.extractIcon("BBQ"), "🗓️");
  assert.strictEqual(AppUtil.titleIconHtml("  🍖  BBQ "), "🍖 BBQ");
  assert.strictEqual(AppUtil.titleIconHtml("🍖"), "🍖");
  assert.strictEqual(AppUtil.titleIconHtml("BBQ & 花火"), "🗓️ BBQ &amp; 花火");
  assert.strictEqual(AppUtil.titleIconHtml(""), "🗓️ ");
});

test("カレンダー：イベントを、始まりの日のマスに分ける", () => {
  const CalendarView = load("js/views/calendar.js", "CalendarView");
  const map = CalendarView.byDayMap([
    { optionId: "a", startAt: "2026-11-07T18:00" },
    { optionId: "b", startAt: "2026-11-07T09:00" },
    { optionId: "c", startAt: "2026-12-01T00:00" },
  ]);
  assert.deepStrictEqual(Object.keys(map), ["2026-10-7", "2026-11-1"]);
  assert.strictEqual(map["2026-10-7"].map((it) => it.optionId).join(","), "a,b");
  assert.strictEqual(CalendarView.dateKey("2026-01-31T23:59"), "2026-0-31");
});

test("答えた人の顔：自分 → コメントした人 → ほかの人 の順。名前・コメントの文字は HTML の外に出ない", () => {
  const context = vm.createContext({ URL, URLSearchParams, console, window: { location: { search: "" } }, OptionCard: { statusClass: (a) => "c" + a } });
  vm.runInContext(utilCode() + "\n" + read("js/views/respondents.js") + "\n;globalThis.Respondents = Respondents;", context);
  const row = {
    respondents: { "○": [{ userId: "p_a", displayName: "あ" }, { userId: "p_b", displayName: XSS }, { userId: "p_me", displayName: "自分" }], "△": [], "×": [] },
    comments: [{ userId: "p_b", text: XSS }],
  };
  const html = context.Respondents.groupsHtml(row, "p_me");
  const order = [...html.matchAll(/<span>([^<]*?)(?:（自分）)?<\/span>/g)].map((m) => m[1]);
  assert.deepStrictEqual(order, ["自分", XSS.replace(/</g, "&lt;").replace(/>/g, "&gt;"), "あ"]);
  assert.ok(!html.includes("<img"));
  assert.strictEqual((html.match(/data-comment-toggle/g) || []).length, 1);
  assert.strictEqual((html.match(/empty-respondents/g) || []).length, 2);
});
