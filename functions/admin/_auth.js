/* 管理画面の共通認証ヘルパー（セキュア・バイ・デフォルト）
 *
 * 許可条件（いずれか）:
 *   1) Cloudflare Access で保護されている（推奨）:
 *      リクエストヘッダ Cf-Access-Authenticated-User-Email が存在すれば認証済みとみなす。
 *   2) 共有トークン: 環境変数 ADMIN_TOKEN が設定されており、
 *      ヘッダ x-admin-token か クエリ ?key= が一致する。
 *
 * どちらも満たさない場合は 403。ADMIN_TOKEN 未設定かつ Access 無しなら必ず 403 になり、
 * 設定するまで管理データは一切露出しない。
 */
export function adminEmail(request) {
  return request.headers.get('Cf-Access-Authenticated-User-Email') || null;
}

export function requireAdmin(context) {
  const { request, env } = context;
  const email = adminEmail(request);
  if (email) return { ok: true, email };

  const token = env && env.ADMIN_TOKEN;
  if (token) {
    const url = new URL(request.url);
    const given = request.headers.get('x-admin-token') || url.searchParams.get('key') || '';
    if (given && given === token) return { ok: true, email: 'token' };
  }
  return {
    ok: false,
    response: new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  };
}

export function noStoreJSON(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
