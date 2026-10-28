// Paperclip button and chips for files waiting to be sent with a message.

import { human, type Attachments } from './attachments'

/** `list` renders the pending chips, `button` the paperclip; a composer places each where it fits. */
export function AttachBar({ att, disabled, list, button }: { att: Attachments; disabled?: boolean; list?: boolean; button?: boolean }) {
  return (
    <>
      {list && (att.files.length > 0 || att.error) && (
        <div className="o-attach-list">
          {att.files.map((f, i) => (
            <span key={i} className="o-attach-chip" title={`${f.name} · ${human(f.size)}`}>
              {f.preview ? <img src={f.preview} alt="" /> : <span className="o-attach-ext">{f.name.split('.').pop()}</span>}
              <span className="o-attach-name">{f.name}</span>
              <button onClick={() => att.remove(i)} aria-label={`Remove ${f.name}`}>×</button>
            </span>
          ))}
          {att.error && <span className="o-attach-error">{att.error}</span>}
        </div>
      )}
      {button && <label className={`o-icon-btn o-attach-btn ${disabled ? 'is-disabled' : ''}`} title="Attach files or images (or drop / paste them)">
        <input
          type="file"
          multiple
          hidden
          disabled={disabled}
          accept={att.accept}
          onChange={(e) => {
            if (e.target.files) void att.add(e.target.files)
            e.target.value = ''
          }}
        />
        <span aria-hidden>📎</span>
      </label>}
    </>
  )
}

