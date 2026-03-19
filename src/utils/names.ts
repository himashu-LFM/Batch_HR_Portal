import type { EmployeeProfileRow } from "../repositories/employeeProfilesRepository.js";

/**
 * Display name: preferred_name → first + last → email.
 */
export function employeeDisplayName(p: Pick<EmployeeProfileRow, "preferred_name" | "first_name" | "last_name" | "email">): string {
  const pref = (p.preferred_name ?? "").trim();
  if (pref) return pref;
  const fn = (p.first_name ?? "").trim();
  const ln = (p.last_name ?? "").trim();
  const full = [fn, ln].filter(Boolean).join(" ").trim();
  if (full) return full;
  return (p.email ?? "").trim() || "Employee";
}
