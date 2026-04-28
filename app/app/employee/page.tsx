import { EmployeeView } from '@/components/employee/EmployeeView'

// In production employeeId comes from auth + an API.
const EMPLOYEE_ID = 'emp-1'

export default function EmployeePage() {
  return <EmployeeView employeeId={EMPLOYEE_ID} />
}
