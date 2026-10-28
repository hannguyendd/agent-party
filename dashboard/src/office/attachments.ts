// Attachments for messages to your own agent: pick, drop or paste files; they're checked against the node's limits
// (same as files from peers) and sent base64-encoded.

import { useState } from 'react'
import type React from 'react'
import type { FileIn } from '../api'

export interface Pending extends FileIn {
  size: number
  preview?: string // object URL for images
}

export interface Limits {
  max_bytes: number
  suffixes: string[]
}

const DEFAULT_LIMITS: Limits = { max_bytes: 5 * 1024 * 1024, suffixes: ['.png', '.jpg', '.pdf', '.txt', '.md', '.json'] }
export const human = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',', 2)[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function useAttachments(limits: Limits | undefined) {
  const lim = limits ?? DEFAULT_LIMITS
  const [files, setFiles] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)

  const add = async (list: FileList | File[]) => {
    const problems: string[] = []
    const next: Pending[] = []
    for (const f of Array.from(list)) {
      // Pasted screenshots arrive as "image.png"; keep a readable, unique-ish name.
      const name = f.name && f.name !== 'image.png' ? f.name : `pasted-${Date.now()}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`
      const suffix = name.slice(name.lastIndexOf('.')).toLowerCase()
      if (!lim.suffixes.includes(suffix)) problems.push(`${name}: ${suffix} files aren't allowed`)
      else if (f.size > lim.max_bytes) problems.push(`${name}: ${human(f.size)} is over the ${human(lim.max_bytes)} limit`)
      else
        next.push({
          name,
          media_type: f.type,
          size: f.size,
          data: await readBase64(f),
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        })
    }
    setError(problems.length ? problems.join(' · ') : null)
    setFiles((cur) => [...cur, ...next].slice(0, 10))
  }
  const remove = (i: number) =>
    setFiles((cur) => {
      if (cur[i]?.preview) URL.revokeObjectURL(cur[i].preview!)
      return cur.filter((_, j) => j !== i)
    })
  const clear = () => {
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
    setFiles([])
    setError(null)
  }
  const payload = (): FileIn[] => files.map(({ name, media_type, data }) => ({ name, media_type, data }))
  return { files, error, add, remove, clear, payload, accept: lim.suffixes.join(',') }
}

export type Attachments = ReturnType<typeof useAttachments>

/** Props that let a composer accept dropped files. */
export function dropTarget(att: Attachments, disabled?: boolean) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!disabled && e.dataTransfer.types.includes('Files')) e.preventDefault()
    },
    onDrop: (e: React.DragEvent) => {
      if (disabled || !e.dataTransfer.files.length) return
      e.preventDefault()
      void att.add(e.dataTransfer.files)
    },
  }
}
