import { useState, type ReactNode } from 'react'
import { api, type Agent, type AgentIn, type Skill } from '../api'
import { ErrorLine, TagInput, errMsg } from './ui'

const SOURCES = ['user', 'project', 'local'] as const

function blank(owner: string): AgentIn {
  return {
    id: `${owner}/`,
    name: '',
    description: '',
    skills: [],
    working_dir: '',
    setting_sources: ['project'],
    allowed_tools: ['Read', 'Bash(ls*)', 'Bash(rg *)', 'Bash(grep *)', 'Bash(git status*)', 'Bash(git log*)', 'Bash(git diff*)'],
    denied_tools: [],
    system_prompt: '',
    model: null,
    contact_policy: 'auto',
  }
}

function Field({ label, hint, published, children }: { label: string; hint?: string; published?: boolean; children: ReactNode }) {
  return (
    <div className="block">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium">{label}</span>
        {published ? (
          <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300" title="Published in this agent's card on the mesh">
            published
          </span>
        ) : (
          <span className="rounded bg-zinc-500/15 px-1 text-[10px] text-muted" title="Stays on this device">
            local only
          </span>
        )}
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

interface Props {
  owner: string
  agent?: Agent
  onSaved: (a: Agent) => void
  onDeleted: () => void
  onStart: (id: string) => void
}

export function AgentForm({ owner, agent, onSaved, onDeleted, onStart }: Props) {
  const [f, setF] = useState<AgentIn>(() => (agent ? { ...agent, skills: agent.skills.map((s) => ({ ...s })) } : blank(owner)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = !agent
  const set = <K extends keyof AgentIn>(k: K, v: AgentIn[K]) => setF((p) => ({ ...p, [k]: v }))
  const setSkill = (i: number, patch: Partial<Skill>) => set('skills', f.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const prefix = `${owner}/`
  const idOk = f.id.startsWith(prefix) && f.id.length > prefix.length

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const body: AgentIn = {
        ...f,
        model: f.model?.trim() || null,
        skills: f.skills
          .filter((s) => s.name.trim())
          .map((s) => ({ ...s, examples: s.examples.map((e) => e.trim()).filter(Boolean) })),
      }
      onSaved(await api.saveAgent(body))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!agent || !confirm(`Delete ${agent.id}? It will be unpublished from the mesh.`)) return
    setBusy(true)
    try {
      await api.deleteAgent(agent.id)
      onDeleted()
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-base font-semibold">{isNew ? 'New agent' : `Edit ${agent.id}`}</h1>
        {!isNew && (
          <button className="btn ml-auto" onClick={() => onStart(agent.id)}>
            Open in office
          </button>
        )}
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <section className="space-y-3 rounded-md border border-line bg-panel p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Agent card</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Agent ID" published hint={`must start with ${prefix}`}>
              <input
                className="input font-mono"
                value={f.id}
                disabled={!isNew}
                onChange={(e) => set('id', e.target.value.startsWith(prefix) ? e.target.value : prefix)}
                placeholder={`${prefix}backend-agent`}
              />
            </Field>
            <Field label="Name" published>
              <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Backend agent" />
            </Field>
          </div>
          <Field label="Description / mission" published hint="what peers can ask this agent for">
            <textarea className="input min-h-16" value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-medium">Skills</span>
              <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">published</span>
              <button
                type="button"
                className="btn ml-auto py-0.5"
                onClick={() => set('skills', [...f.skills, { name: '', description: '', examples: [], tags: [] }])}
              >
                + Add skill
              </button>
            </div>
            {f.skills.length === 0 && <div className="text-[11px] text-muted">No skills. Skills and example requests help other agents decide when to ask this one.</div>}
            <div className="space-y-2">
              {f.skills.map((s, i) => (
                <div key={i} className="space-y-1.5 rounded border border-line bg-panel-2/50 p-2">
                  <div className="flex gap-1.5">
                    <input className="input w-48 font-mono" placeholder="skill name" value={s.name} onChange={(e) => setSkill(i, { name: e.target.value })} />
                    <input className="input flex-1" placeholder="description" value={s.description} onChange={(e) => setSkill(i, { description: e.target.value })} />
                    <button type="button" className="btn" onClick={() => set('skills', f.skills.filter((_, j) => j !== i))} title="Remove skill">
                      ×
                    </button>
                  </div>
                  <TagInput value={s.tags} onChange={(tags) => setSkill(i, { tags })} placeholder="tags (Enter or comma)" />
                  {s.examples.map((ex, k) => (
                    <div key={k} className="flex gap-1.5 pl-3">
                      <span className="pt-1 text-[11px] text-muted">e.g.</span>
                      <input
                        className="input flex-1"
                        value={ex}
                        placeholder="example request"
                        onChange={(e) => setSkill(i, { examples: s.examples.map((x, m) => (m === k ? e.target.value : x)) })}
                      />
                      <button type="button" className="btn" onClick={() => setSkill(i, { examples: s.examples.filter((_, m) => m !== k) })}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className="ml-3 text-[11px] text-accent hover:underline" onClick={() => setSkill(i, { examples: [...s.examples, ''] })}>
                    + example request
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-md border border-line bg-panel p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Local runtime (never published)</div>
          <Field label="Working directory" hint="absolute path on this device; must exist">
            <input className="input font-mono" value={f.working_dir} onChange={(e) => set('working_dir', e.target.value)} placeholder="~/code/my-service" />
          </Field>
          <Field label="Settings sources" hint="which Claude Code settings / CLAUDE.md files to load">
            <div className="flex gap-4 pt-0.5">
              {SOURCES.map((src) => (
                <label key={src} className="flex items-center gap-1.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={f.setting_sources.includes(src)}
                    onChange={(e) =>
                      set('setting_sources', e.target.checked ? [...f.setting_sources, src] : f.setting_sources.filter((x) => x !== src))
                    }
                  />
                  {src}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Allowed tools" hint="run without asking">
              <TagInput value={f.allowed_tools} onChange={(v) => set('allowed_tools', v)} placeholder="Read, Bash(rg *)" />
            </Field>
            <Field label="Denied tools" hint="never allowed">
              <TagInput value={f.denied_tools} onChange={(v) => set('denied_tools', v)} placeholder="Bash, Write" />
            </Field>
          </div>
          <div className="text-[11px] text-muted">Tools in neither list prompt you for approval.</div>
          <Field label="Extra system prompt">
            <textarea className="input min-h-20 font-mono text-[12px]" value={f.system_prompt} onChange={(e) => set('system_prompt', e.target.value)} />
          </Field>
          <Field label="Model" hint="optional; blank = Claude Code default">
            <input className="input w-64 font-mono" value={f.model ?? ''} onChange={(e) => set('model', e.target.value)} placeholder="e.g. sonnet" />
          </Field>
          <Field label="Before it messages other agents" hint="when it decides on its own to ask a colleague's agent">
            <select className="input w-64" value={f.contact_policy ?? 'auto'} onChange={(e) => set('contact_policy', e.target.value as 'auto' | 'ask')}>
              <option value="auto">Go ahead (it finds the right person and asks)</option>
              <option value="ask">Ask me first (approve each message)</option>
            </select>
          </Field>
        </section>

        <ErrorLine error={error} />
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary px-3 py-1.5" disabled={busy || !idOk || !f.name.trim() || !f.working_dir.trim()}>
            {isNew ? 'Create agent' : 'Save changes'}
          </button>
          {!isNew && (
            <button type="button" className="btn-danger ml-auto" disabled={busy} onClick={remove}>
              Delete agent
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
