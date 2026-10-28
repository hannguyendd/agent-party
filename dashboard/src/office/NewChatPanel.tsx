// Starting a private chat with one of my agents: same layout as a conversation, nothing sent until the first message.

import { useState } from 'react'
import { api, type FileIn } from '../api'
import { errMsg } from '../components/format'
import type { LiveState } from '../useLiveState'
import { Composer } from './Composer'
import { Icon } from './Icon'
import { Avatar } from './OfficeChat'
import { who } from './people'

interface Props {
  state: LiveState
  agentId: string
  onBack: () => void
  onCreated: (convId: string) => void
}

export function NewChatPanel({ state, agentId, onBack, onCreated }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = who(state, agentId)
  const me = agentId.split('/')[0]
  const candidates = (state.office?.agents ?? []).filter((a) => a.owner !== me).map((a) => who(state, a.agent_id))

  const send = async (t: string, files: FileIn[]) => {
    setBusy(true)
    setError(null)
    try {
      const conv = await api.startConversation(agentId, t, files)
      setText('')
      onCreated(conv.id)
      return true
    } catch (e) {
      setError(errMsg(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="o-frame office-conv">
      <header className="o-conv-head">
        <button className="o-icon-btn" onClick={onBack} aria-label="Back" title="Back">
          <Icon name="back" />
        </button>
        <div className="o-conv-faces">
          <Avatar w={mine} size={34} />
        </div>
        <div className="o-conv-title">
          <strong>New chat with {mine.name}</strong>
        </div>
        <span className="o-conv-sub">
          <span className="o-chip is-kind">Private</span>
          <span className="o-conv-owner">only you see this</span>
        </span>
      </header>
      <div className="o-chat">
        <div className="o-chat-empty o-new-chat">
          <strong>What should {mine.name} do?</strong>
          <span>Ask a question, hand it a task, or point it at a colleague with <kbd>@</kbd>.</span>
          <span>Drop or paste files and screenshots to give it context.</span>
        </div>
      </div>
      <Composer
        value={text}
        onChange={setText}
        onSend={send}
        to={`To ${mine.name} · only you see this`}
        placeholder={`Message ${mine.name}…`}
        candidates={candidates}
        limits={state.node?.files}
        allowFiles
        busy={busy}
        error={error}
      />
    </div>
  )
}
