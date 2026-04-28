import { Button } from '@/components/ui/button'

export type ApprovalActionsProps = {
  onApprove: () => void
  onDeny: () => void
  // Approval is blocked until the fresh-read completes, and during the
  // approve/deny mutation itself. Callers compose those two reasons.
  disabled?: boolean
  // When a mutation is in flight, the corresponding button shows a label change.
  busy?: 'approve' | 'deny' | null
}

export function ApprovalActions({
  onApprove,
  onDeny,
  disabled = false,
  busy = null,
}: ApprovalActionsProps) {
  const approving = busy === 'approve'
  const denying = busy === 'deny'
  const anyBusy = approving || denying
  return (
    <div className="flex items-center gap-2" data-testid="approval-actions">
      <Button
        type="button"
        onClick={onApprove}
        disabled={disabled || anyBusy}
        data-testid="approve-button"
      >
        {approving ? 'Approving…' : 'Approve'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onDeny}
        disabled={disabled || anyBusy}
        data-testid="deny-button"
      >
        {denying ? 'Denying…' : 'Deny'}
      </Button>
    </div>
  )
}
