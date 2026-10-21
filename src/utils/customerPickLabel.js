/** Alamat singkat pelanggan untuk kartu nota: jalan, Blok, No. (sama dengan POS my-waschen) */
export function customerPickLabel(c) {
  const street = String(c.street || '').trim();
  const block = String(c.block || '').trim();
  const house = String(c.houseNumber || '').trim();
  const parts = [];
  if (street && street !== '-') parts.push(street);
  if (block && !street.toLowerCase().includes(block.toLowerCase())) {
    parts.push(/^blok\b/i.test(block) ? block : `Blok ${block}`);
  }
  if (house && !street.toLowerCase().includes(house.toLowerCase())) {
    parts.push(/^no\.?\b/i.test(house) ? house : `No. ${house}`);
  }
  return parts.join(', ');
}
