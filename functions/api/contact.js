/* Cloudflare Pages Function: POST /api/contact
 *
 * フォーム送信を受け取り、メールで通知します（Resend を使用）。
 *
 * 有効化するには、Cloudflare Pages のプロジェクト設定
 *   Settings → Environment variables（Production / Preview）に以下を登録してください：
 *     RESEND_API_KEY = re_xxxxxxxx        … Resend (https://resend.com) のAPIキー
 *     CONTACT_TO     = you@example.com     … 通知の受信先メールアドレス
 *     CONTACT_FROM   = inventist.jp <noreply@inventist.jp>   … 任意。inventist.jp はCloudflare管理下なのでドメイン認証可
 *
 * 未設定の場合は {ok:false, error:"not_configured"} を返し、フロント側は
 * 「お問い合わせは contact@inventist.jp へ」のフォールバックを表示します。
 */

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const ct = request.headers.get('content-type') || '';
    let data = {};
    if (ct.indexOf('application/json') >= 0) {
      data = await request.json();
    } else {
      const fd = await request.formData();
      fd.forEach(function (v, k) { data[k] = v; });
    }

    // ハニーポット（ボット対策）: _gotcha に入力があれば成功扱いで破棄
    if (data._gotcha) return json({ ok: true });

    // Cloudflare Turnstile 検証（任意）: TURNSTILE_SECRET 設定時のみ有効化される
    if (env.TURNSTILE_SECRET) {
      const token = data['cf-turnstile-response'] || data.turnstile || '';
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'secret=' + encodeURIComponent(env.TURNSTILE_SECRET) + '&response=' + encodeURIComponent(token)
      });
      const vr = await verify.json();
      if (!vr.success) return json({ ok: false, error: 'turnstile_failed' }, 400);
    }

    if (!data.email || !data.name) return json({ ok: false, error: 'missing_fields' }, 400);

    const to = env.CONTACT_TO;
    const key = env.RESEND_API_KEY;
    if (!to || !key) return json({ ok: false, error: 'not_configured' }, 200);

    const subject = data._subject || '【inventist.jp】お問い合わせ';
    const order = ['name', 'company', 'email', 'tel', 'type', 'want', 'deal_type', 'field', 'patent_no', 'message'];
    const labels = {
      name: 'お名前', company: '会社・組織名', email: 'メール', tel: '電話',
      type: '種別', want: 'ご希望', deal_type: '取引形態', field: '技術分野',
      patent_no: '特許番号', message: '内容'
    };
    let lines = [];
    order.forEach(function (k) { if (data[k]) lines.push((labels[k] || k) + '：' + data[k]); });
    Object.keys(data).forEach(function (k) {
      if (k[0] !== '_' && order.indexOf(k) < 0 && k !== 'consent') lines.push(k + '：' + data[k]);
    });
    if (data._page) lines.push('（送信元ページ：' + data._page + '）');
    const text = lines.join('\n');
    const from = env.CONTACT_FROM || 'inventist.jp <onboarding@resend.dev>';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from, to: [to], reply_to: data.email, subject: subject, text: text })
    });

    if (resp.ok) return json({ ok: true });
    return json({ ok: false, error: 'send_failed' }, 200);
  } catch (e) {
    return json({ ok: false, error: 'exception' }, 200);
  }
}

export async function onRequestGet() {
  return json({ ok: true, service: 'inventist contact', method: 'POST only' });
}
