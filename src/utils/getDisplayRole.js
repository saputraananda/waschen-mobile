/** Role operasional dari mst_role (Frontliner, Washing Staff, dll.) */
export default function getDisplayRole(user) {
  if (!user) return null;
  return user.assignedRole || user.mst_role || null;
}
