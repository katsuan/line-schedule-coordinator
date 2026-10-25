// 前の名前のファイル。入口はページの直下の app.js に移した（README の「前の名前のファイル」）。
// 古い index.html を覚えている端末のために、新しいファイルを読むだけ。2026-11-25 ごろ消す
(function () {
  var base = document.currentScript ? document.currentScript.src : document.baseURI;
  document.write('<script src="' + new URL('../app.js', base).href + '"><\/script>'); // qcheck-ok: 前の HTML のときだけ
}());
