import { useState } from 'react'

import type { ChatMessage } from '../game/types'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (message: string) => void
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('')

  const submit = () => {
    const clean = draft.trim()
    if (!clean) {
      return
    }
    onSend(clean)
    setDraft('')
  }

  return (
    <section className="rounded-[2rem] border border-emerald-900/10 bg-white/90 p-5 shadow-xl shadow-emerald-950/10 backdrop-blur">
      <h2 className="text-lg font-black text-emerald-950">Room chat</h2>
      <div className="mt-4 h-48 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id}>
              <p className="text-xs font-black text-orange-600">{message.name}</p>
              <p className="text-sm font-semibold text-slate-700">{message.text}</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-medium text-slate-500">No messages yet.</p>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-2xl border border-emerald-900/10 px-4 py-3 font-semibold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
          value={draft}
          maxLength={160}
          placeholder="Cheer, coach, or heckle kindly..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit()
            }
          }}
        />
        <button
          className="rounded-2xl bg-orange-500 px-4 py-3 font-black text-white transition hover:bg-orange-600"
          onClick={submit}
        >
          Send
        </button>
      </div>
    </section>
  )
}
