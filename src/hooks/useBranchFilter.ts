import { useAuth } from '../context/AuthContext';

/**
 * Returns the branch restriction for the current user:
 *  - `null`  → no restriction (ADMIN / manager / root)
 *  - `string` → must filter to this branchId (CASHIER with assigned branch)
 *
 * Usage:
 *   const restrictedBranchId = useBranchFilter();
 *   const rows = data.filter(d => !restrictedBranchId || d.branchId === restrictedBranchId);
 */
export function useBranchFilter(): string | null {
  const { user } = useAuth();
  if (!user) return null;
  // Root and Admin users see everything
  if (user.isRoot || user.role === 'ADMIN') return null;
  // CASHIER — restrict to their assigned branch
  if (user.role === 'CASHIER' && user.branchId) return user.branchId;
  // Any other role with an explicit branchId assigned → restrict
  if (user.branchId) return user.branchId;
  return null;
}

/**
 * Returns true if the current user is a CASHIER (or any non-admin role)
 * and should see restricted data only.
 */
export function useIsRestricted(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.isRoot || user.role === 'ADMIN') return false;
  return true;
}
