/**
 * 채널 URL 표시용: 비어 있지 않으면 새 창 링크에 사용할 href.
 * 프로토콜이 없으면 https:// 를 붙여 상대 경로로 열리는 것을 방지합니다.
 */
export function channelExternalHref(
  raw: string | null | undefined,
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
