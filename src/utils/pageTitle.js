/** Suffix judul tab browser untuk seluruh halaman Waschen Mobile */
export const APP_TITLE_SUFFIX = 'Waschen Mobile';

/**
 * Set document.title → "{Halaman} | Waschen Mobile"
 * @param {string} [page] nama halaman tanpa suffix
 */
export function setPageTitle(page) {
  const name = String(page || '').trim()
    .replace(/\s*[-|]\s*Waschen Mobile\s*$/i, '')
    .trim();
  document.title = name ? `${name} | ${APP_TITLE_SUFFIX}` : APP_TITLE_SUFFIX;
}
