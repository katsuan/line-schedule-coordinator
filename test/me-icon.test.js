// 一覧の見出しの本人のアイコン（js/views/meIcon.js）と、LIFF を2回起こさないつなぎ（js/platform.js）。node --test test/
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function loadMeIcon() {
  const context = vm.createContext({ console });
  vm.runInContext(read("js/views/meIcon.js") + "\n;globalThis.MeIcon = MeIcon;", context, { filename: "meIcon.js" });
  return context.MeIcon;
}

test("ログイン中は、だれで回答しているか・回答に出る名前・どこでも同じ予定が見られることを出す", () => {
  const texts = Array.from(loadMeIcon().rows({ me: { name: "かつ", picture: "" }, loggedIn: true }), (r) => r.text);
  assert.strictEqual(texts[0], "かつ さんでログインしています");
  assert.match(texts.join("\n"), /○△× とコメントには、この名前とアイコンが出ます/);
  // くるかなは予定と回答を GAS に残すので、端末ごとの記録のうつし方・ボットの話は出さない
  assert.doesNotMatch(texts.join("\n"), /記録の控え|この端末に残ります|ボット/);
});

test("まだログインしていないときは、そのことだけ", () => {
  const texts = Array.from(loadMeIcon().rows({ me: null, loggedIn: false }), (r) => r.text);
  assert.deepStrictEqual(texts, ["まだ LINE にログインしていません"]);
});

test("Q キットの line-me.js を読み、LIFF は AppPlatform が起こしたものを渡す（2回起こさない）", () => {
  const html = read("index.html");
  assert.match(html, /line-share\/shared\/line-me\.js\?v=\d+" defer/);
  assert.match(html, /js\/views\/meIcon\.js\?v=\d+/);
  const me = read("js/views/meIcon.js");
  assert.match(me, /bot: false/);
  assert.match(me, /ready: AppPlatform\.liffReady\(\)/);
  assert.doesNotMatch(me, /liff\.init/);
  assert.strictEqual((read("js/platform.js").match(/liff\.init\(/g) || []).length, 1);
  // 名前・アイコンの URL は escapeHtml・avatarHtml を通して入れる
  assert.match(me, /AppUtil\.escapeHtml\(st\.loggedIn && me\.name/);
  assert.match(me, /AppUtil\.avatarHtml\(/);
});

test("一覧の画面だけで出す（予定の画面には見出しのロゴがない）", () => {
  assert.match(read("js/views/list.js"), /MeIcon\.mount\(root, ctx\.identity\)/);
  assert.doesNotMatch(read("js/views/detail.js") + read("js/views/detailHeader.js"), /MeIcon/);
});
