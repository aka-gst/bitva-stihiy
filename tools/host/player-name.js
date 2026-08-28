(() => {
  let activeRequest = null;

  function ensureDialog() {
    let dialog = document.querySelector('#aka-name-dialog');
    if (dialog) return dialog;
    const style = document.createElement('style');
    style.textContent = `
      #aka-name-dialog[hidden]{display:none!important}
      #aka-name-dialog{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:#07040bd9;backdrop-filter:blur(5px)}
      #aka-name-dialog form{width:min(360px,100%);padding:22px;border:2px solid #76ff9f;background:linear-gradient(145deg,#241132,#0d1714);box-shadow:8px 8px #050207,0 0 38px #76ff9f25;color:#f6edff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      #aka-name-dialog b{display:block;margin-bottom:7px;color:#76ff9f;font:900 24px/1 system-ui,sans-serif}
      #aka-name-dialog p{margin:0 0 15px;color:#cbbbd6;font-size:11px;line-height:1.45}
      #aka-name-dialog label{display:block;color:#bc70ff;font-size:9px;font-weight:800;letter-spacing:.12em}
      #aka-name-dialog input{width:100%;height:50px;margin:7px 0 12px;padding:0 13px;border:1px solid #bc70ff;background:#08060d;color:#ffe06b;font:800 22px ui-monospace,monospace;text-transform:none;outline:none}
      #aka-name-dialog input:focus{border-color:#76ff9f;box-shadow:0 0 18px #76ff9f25}
      #aka-name-dialog button{width:100%;min-height:46px;border:2px solid #76ff9f;background:#194d31;color:#fff;font:800 12px ui-monospace,monospace;letter-spacing:.08em;cursor:pointer;box-shadow:4px 4px #050207}
      #aka-name-dialog small{display:block;margin-top:8px;color:#8f819a;font-size:8px;text-align:right}
    `;
    dialog = document.createElement('div');
    dialog.id = 'aka-name-dialog';
    dialog.hidden = true;
    dialog.innerHTML = '<form><b>НОВЫЙ РЕЗУЛЬТАТ</b><p>Как записать тебя в глобальной таблице?</p><label for="aka-player-name">ИМЯ ИГРОКА</label><input id="aka-player-name" name="player" maxlength="6" minlength="1" autocomplete="nickname" autocapitalize="none" spellcheck="false" required><button type="submit">ЗАПИСАТЬ РЕЗУЛЬТАТ</button><small>МАКСИМУМ 6 СИМВОЛОВ</small></form>';
    document.head.append(style);
    document.body.append(dialog);
    return dialog;
  }

  window.requestPlayerName = () => {
    if (activeRequest) return activeRequest;
    const dialog = ensureDialog();
    const form = dialog.querySelector('form');
    const input = dialog.querySelector('input');
    input.value = (localStorage.getItem('aka-gst-nickname') || '').slice(0, 6);
    dialog.hidden = false;
    setTimeout(() => input.focus(), 0);
    activeRequest = new Promise(resolve => {
      form.onsubmit = event => {
        event.preventDefault();
        const value = input.value.trim().slice(0, 6);
        if (!value) return input.focus();
        localStorage.setItem('aka-gst-nickname', value);
        dialog.hidden = true;
        activeRequest = null;
        resolve(value);
      };
    });
    return activeRequest;
  };
})();
