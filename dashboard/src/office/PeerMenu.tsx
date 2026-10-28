// Menu shown when the owner clicks someone else's agent in the Office (CONTEXT.md: Inquiry, Assignment).

import { useState } from 'react'
import { api, type Conversation, type OfficeAgent } from '../api'
import { errMsg } from '../components/ui'
import type { PeerClick } from './OfficeScene'
import { ownerCss } from './skins'

export function PeerMenu(props: {
  click: PeerClick
  peer: OfficeAgent
  present: boolean
  selectedMine: string[]
  conversations: Conversation[]
  onClose: () => void
  onWalk: () => void
  onOpen: (id: string) => void
  onSent: (msg: string) => void
  onError: (msg: string) => void
  /** Design preview: nothing is sent. */
  preview?: boolean
}) {
  const { click, peer } = props
  const [mode, setMode] = useState<'menu' | 'inquiry' | 'assignment'>('menu')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // Who acts: a selected agent of mine within reach, else any of mine within reach.
  const asker = click.reachableBy.find((id) => props.selectedMine.includes(id)) ?? click.reachableBy[0]
  const latest = [...props.conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]

  const send = async () => {
    if (!asker || !text.trim()) return
    setBusy(true)
    try {
      if (props.preview) {
        props.onSent(mode === 'inquiry' ? `(Preview) ${asker} sẽ hỏi ${peer.agent_id}` : `(Preview) ${asker} sẽ giao việc cho ${peer.agent_id}`)
      } else if (mode === 'inquiry') {
        // Inquiry: our agent asks the peer over the mesh; the reply comes back into a local conversation.
        const prompt =
          `Use mcp__mesh__send_message to ask ${peer.agent_id} the question below, then tell me what they answered.\n\n` +
          `Question: ${text.trim()}`
        await api.startConversation(asker, prompt)
        props.onSent(`${asker} đang hỏi ${peer.agent_id}…`)
      } else {
        // Assignment: sent as written; the peer's owner must accept before their agent starts (ADR 0002).
        await api.assign(asker, peer.agent_id, text.trim())
        props.onSent(
          props.present
            ? `Đã giao việc cho ${peer.agent_id}, chờ ${peer.owner} nhận…`
            : `Đã giao việc. ${peer.owner} đang vắng: đã gửi thông báo, chờ tối đa 15 phút.`,
        )
      }
    } catch (e) {
      props.onError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="absolute z-10 w-64 space-y-2 rounded border border-line bg-panel p-3 text-xs shadow-lg"
      // Above the peer's head so it never covers the two agents; flip below when too close to the top.
      style={{
        left: Math.max(136, click.screen.x),
        top: click.screen.y < 230 ? click.screen.y + 70 : click.screen.y - 10,
        transform: click.screen.y < 230 ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: ownerCss(peer.owner) }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono font-semibold">{peer.agent_id}</div>
          <div className="text-muted">
            {peer.name} · owner {peer.owner} {props.present ? 'có mặt' : 'vắng'}
          </div>
        </div>
        <button className="text-muted hover:text-fg" onClick={props.onClose}>
          ✕
        </button>
      </div>

      {mode !== 'menu' ? (
        <div className="space-y-1">
          <div className="text-muted">
            <span className="font-mono">{asker}</span> {mode === 'inquiry' ? 'sẽ hỏi:' : 'giao việc:'}
          </div>
          <textarea
            className="input h-20 resize-none"
            autoFocus
            placeholder={mode === 'inquiry' ? 'Ví dụ: schema bảng user hiện tại là gì?' : 'Ví dụ: sửa test login đang fail ở CI'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {mode === 'assignment' && (
            <div className="text-muted">
              {props.present
                ? `${peer.owner} sẽ nhận thẻ Nhận / Từ chối. Nhận xong agent được sửa file trong việc này.`
                : `${peer.owner} đang vắng: sẽ gửi thông báo tới máy của họ, chờ tối đa 15 phút rồi tự từ chối.`}
            </div>
          )}
          <div className="flex gap-1">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={send}>
              Gửi
            </button>
            <button className="btn" onClick={() => setMode('menu')}>
              Quay lại
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {asker ? (
            <>
              <button className="btn justify-start" onClick={() => setMode('inquiry')}>
                🔎 Hỏi thông tin
              </button>
              <button className="btn justify-start" onClick={() => setMode('assignment')}>
                🛠 Giao việc {!props.present && <span className="text-muted">(owner vắng)</span>}
              </button>
            </>
          ) : (
            <>
              <button className="btn justify-start" disabled title="Đưa một agent của bạn tới gần trước">
                🔎 Hỏi thông tin / 🛠 Giao việc <span className="text-muted">(cần đứng gần)</span>
              </button>
              <button className="btn justify-start" disabled={!props.selectedMine.length} onClick={props.onWalk}>
                🚶 Đi tới {props.selectedMine.length ? `(${props.selectedMine.length} agent đang chọn)` : '(chọn agent của bạn trước)'}
              </button>
            </>
          )}
          {latest && (
            <button className="btn justify-start" onClick={() => props.onOpen(latest.id)}>
              💬 Mở conversation
            </button>
          )}
        </div>
      )}
    </div>
  )
}
