/** Role operasional dari mst_role (Frontliner, Washing Staff, dll.) */
export default function getDisplayRole(user) {
  if (!user) return null;
  return user.assignedRole || user.mst_role || null;
}

/** Label bahasa Indonesia. Nilai role asli tetap dipakai untuk logika. */
const ROLE_LABEL = {
  'Washing Staff': 'Tim Cuci',
  'Ironing Staff': 'Tim Setrika',
  'Packing Staff': 'Tim Packing',
  'Delivery Staff': 'Tim Delivery'
};

export function getRoleLabel(user) {
  const role = typeof user === 'string' ? user : getDisplayRole(user);
  if (!role) return null;
  return ROLE_LABEL[role] || role;
}

/** Baris subjudul header: "Tim Cuci · Waschen Cabang X" */
export function getHeaderSubtitle(user) {
  const outlet = user?.assignedOutletName || user?.assigned_outlet_name || null;
  return [getRoleLabel(user), outlet].filter(Boolean).join(' · ');
}
