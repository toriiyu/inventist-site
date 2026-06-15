/* inventist.jp 共通フォームハンドラ
   data-ajax="1" のフォームを /api/contact へ非同期送信し、成功/失敗を画面に表示します。
   送信先メールは Cloudflare Pages の環境変数（RESEND_API_KEY / CONTACT_TO）で有効化されます。 */
(function(){
  function panel(html, ok){
    var d = document.createElement('div');
    d.className = 'note';
    d.style.marginTop = '16px';
    if(ok){ d.style.borderLeftColor = '#1f7a45'; }
    d.innerHTML = html;
    return d;
  }
  var forms = document.querySelectorAll('form[data-ajax="1"]');
  Array.prototype.forEach.call(forms, function(f){
    f.addEventListener('submit', function(e){
      e.preventDefault();
      if(!f.checkValidity){ } else if(!f.checkValidity()){ f.reportValidity(); return; }
      var btn = f.querySelector('button[type=submit]');
      var orig = btn ? btn.textContent : '';
      if(btn){ btn.disabled = true; btn.textContent = '送信中…'; }
      var data = {};
      new FormData(f).forEach(function(v,k){ data[k] = v; });
      data._page = location.pathname;
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function(r){
        return r.json().catch(function(){ return { ok:false }; });
      }).then(function(res){
        if(res && res.ok){
          f.style.display = 'none';
          f.parentNode.appendChild(panel('<strong>お申し込みを受け付けました。</strong><br>担当より折り返しご連絡いたします。ありがとうございました。', true));
        } else {
          if(btn){ btn.disabled = false; btn.textContent = orig; }
          if(!f.parentNode.querySelector('.form-fallback')){
            var p = panel('現在フォーム送信の準備中です。お手数ですが <a href="mailto:contact@inventist.jp">contact@inventist.jp</a> までご連絡ください。', false);
            p.classList.add('form-fallback');
            f.parentNode.appendChild(p);
          }
        }
      }).catch(function(){
        if(btn){ btn.disabled = false; btn.textContent = orig; }
        if(!f.parentNode.querySelector('.form-fallback')){
          var p = panel('送信に失敗しました。<a href="mailto:contact@inventist.jp">contact@inventist.jp</a> までご連絡ください。', false);
          p.classList.add('form-fallback');
          f.parentNode.appendChild(p);
        }
      });
    });
  });
})();
