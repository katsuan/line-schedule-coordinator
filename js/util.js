// 前の名前のファイル。中身は js/markup.js・js/dates.js・js/notice.js に分けた（README の「前の名前のファイル」）。
// 古い index.html を覚えている端末のために、新しいファイルを読むだけ。2026-11-25 ごろ消す
(function () {
  var base = document.currentScript ? document.currentScript.src : document.baseURI;
  ['markup.js', 'dates.js', 'notice.js'].forEach(function (file) {
    document.write('<script src="' + new URL(file, base).href + '"><\/script>'); // qcheck-ok: 前の HTML のときだけ、続くファイルより先に読ませる
  });
}());
