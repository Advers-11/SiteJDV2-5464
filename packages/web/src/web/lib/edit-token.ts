/** Token de edição por chaveamento, guardado no navegador do visitante. */

const key = (slug: string) => `cf_edit_${slug}`;

export function getEditToken(slug: string): string | null {
  try {
    return localStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function setEditToken(slug: string, token: string) {
  try {
    localStorage.setItem(key(slug), token);
  } catch {
    /* noop */
  }
}

export function clearEditToken(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    /* noop */
  }
}
