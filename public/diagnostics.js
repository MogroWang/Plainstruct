/** 启动诊断层 -- 白屏时把加载/脚本错误显示为可见遮罩,便于反馈定位。
 *  应用挂载成功后自动移除;CSP script-src 'self' 允许此外链脚本。 */
(function () {
  "use strict";

  function show(title, detail) {
    var box = document.getElementById("__boot_error__");
    if (!box) {
      box = document.createElement("div");
      box.id = "__boot_error__";
      box.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:#fffdf8;color:#8c2f1b;" +
        "padding:20px;overflow:auto;font:13px/1.7 ui-monospace,Consolas,monospace;" +
        "white-space:pre-wrap;border-top:4px solid #8c2f1b";
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent += (box.textContent ? "\n\n" : "") + "[" + title + "]\n" + detail;
  }

  // 脚本错误与资源加载失败(capture 阶段才能拿到资源错误的 target)
  window.addEventListener(
    "error",
    function (e) {
      if (e.target && e.target !== window && (e.target.src || e.target.href)) {
        show("资源加载失败", e.target.src || e.target.href || "(unknown)");
        return;
      }
      show(
        "脚本错误",
        (e.message || "unknown") + "\n" + ((e.error && e.error.stack) || "(no stack)"),
      );
    },
    true,
  );

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    show("未处理的 Promise 拒绝", (r && (r.stack || r.message)) || String(r));
  });

  // 应用挂载成功后自动移除遮罩
  var removed = false;
  var observer = new MutationObserver(function () {
    if (removed) return;
    var app = document.getElementById("app");
    if (app && app.childElementCount) {
      removed = true;
      var box = document.getElementById("__boot_error__");
      if (box) box.remove();
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 挂载超时兜底:15s 仍无内容则给出提示
  window.setTimeout(function () {
    var app = document.getElementById("app");
    if (app && !app.childElementCount) {
      show(
        "启动超时",
        "应用 15 秒内未完成挂载。常见原因:\n" +
          "1. WebView2 运行时版本过旧或安装异常(到「设置 > 应用」检查 Microsoft Edge WebView2)\n" +
          "2. 脚本/资源加载被安全策略拦截\n" +
          "上方如有其他错误信息,请一并截图反馈。",
      );
    }
  }, 15000);
})();
