/**
 * Utility function to format employee names to Title Case (Capital Each Word).
 * Converts uppercase names like "ANANDA PRATHAMA SAPUTRA" -> "Ananda Prathama Saputra".
 *
 * @param {string} name - The raw name string to format.
 * @returns {string} The formatted name string.
 */
export const formatName = (name) => {
  if (!name || typeof name !== 'string') return '';

  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      // Handle words with hyphen or initials (e.g. M.-Iqbal)
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export default formatName;
