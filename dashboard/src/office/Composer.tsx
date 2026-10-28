// The message box used by every chat panel: text with @mentions on top, then a row with the hint, the paperclip and
// Send. Attachments (pick / drop / paste) are optional.

import type { FileIn } from '../api'
import { AttachBar } from './AttachBar'
import { dropTarget, useAttachments, type Limits } from './attachments'
import { Icon } from './Icon'
import { MentionInput } from './MentionInput'
import { withMentionIds } from './people'
import type { Who } from './people'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Return true when the message was sent (the attachments are then cleared). */
  onSend: (text: string, files: FileIn[]) => Promise<boolean>
  to: string
  placeholder: string
  candidates: Who[]
  limits?: Limits
  allowFiles: boolean
  disabled?: boolean
  busy?: boolean
  error?: string | null
}

export function Composer(p: Props) {
  const att = useAttachments(p.limits)
  const files = p.allowFiles ? att.files : []
  const ready = !p.disabled && !p.busy && (!!p.value.trim() || files.length > 0)
  const send = async () => {
    if (!ready) return
    if (await p.onSend(withMentionIds(p.value.trim(), p.candidates), p.allowFiles ? att.payload() : [])) att.clear()
  }
  return (
    <footer className="o-composer" {...dropTarget(att, !p.allowFiles || p.disabled)}>
      <div className="o-composer-to">{p.to}</div>
      {p.error && <div className="office-conv-error">{p.error}</div>}
      {p.allowFiles && <AttachBar att={att} list />}
      <MentionInput
        value={p.value}
        onChange={p.onChange}
        onSubmit={() => void send()}
        onPasteFiles={p.allowFiles ? (f) => void att.add(f) : undefined}
        candidates={p.candidates}
        disabled={p.disabled}
        placeholder={p.placeholder}
      />
      <div className="o-composer-row">
        <span className="o-composer-hint">
          {p.candidates.length > 0 && <><kbd>@</kbd> mention an agent · </>}
          {p.allowFiles ? 'drop or paste files · ' : ''}
          <kbd>Enter</kbd> send
        </span>
        {p.allowFiles && <AttachBar att={att} button disabled={p.disabled || p.busy} />}
        <button className="btn-primary" disabled={!ready} onClick={() => void send()}>
          <Icon name="send" />Send
        </button>
      </div>
    </footer>
  )
}
