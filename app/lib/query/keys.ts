// Hierarchical query keys. The hierarchy lets us invalidate at any granularity:
//   queryClient.invalidateQueries({ queryKey: balancesKey() })           // every employee
//   queryClient.invalidateQueries({ queryKey: balancesKey(employeeId) }) // every cell of one employee
//   queryClient.invalidateQueries({ queryKey: balanceKey(emp, loc) })    // one specific cell
//
// Tuple shape:
//   ['balances'] | ['balances', employeeId] | ['balances', employeeId, locationId]
export const balancesRoot = ['balances'] as const

export function balancesKey(employeeId: string) {
  return ['balances', employeeId] as const
}

export function balanceKey(employeeId: string, locationId: string) {
  return ['balances', employeeId, locationId] as const
}

export const requestsRoot = ['requests'] as const

export function requestsKey(employeeId: string) {
  return ['requests', employeeId] as const
}
