import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const cleanName = name.trim() || 'Guest golfer'

  const createRoom = () => {
    const roomId = randomRoomCode()
    window.localStorage.setItem('golf:name', cleanName)
    window.location.assign(`/room/${roomId}?name=${encodeURIComponent(cleanName)}`)
  }

  const joinRoom = () => {
    const roomId = joinCode.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
    if (!roomId) {
      return
    }
    window.localStorage.setItem('golf:name', cleanName)
    window.location.assign(`/room/${roomId}?name=${encodeURIComponent(cleanName)}`)
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#fff7ed] text-emerald-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(246,130,31,0.22),_transparent_32rem),radial-gradient(circle_at_bottom_right,_rgba(20,83,45,0.18),_transparent_28rem)]" />
      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-orange-600">
              Durable Objects Demo
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
              Multiplayer mini-golf synchronized at the edge.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-emerald-900/75">
              This demo uses one Cloudflare Durable Object per room to coordinate players,
              spectators, chat, cursors, reactions, scoring, and authoritative shot physics.
            </p>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ['4 golfers', 'turn-based play'],
                ['unlimited spectators', 'same room state'],
                ['SQLite-backed', 'scores and leaderboard'],
              ].map(([title, label]) => (
                <div key={title} className="rounded-3xl border border-emerald-900/10 bg-white/70 p-4 shadow-lg shadow-emerald-950/5 backdrop-blur">
                  <p className="font-black text-emerald-950">{title}</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-800/70">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-emerald-950/15 backdrop-blur">
            <div className="rounded-[1.5rem] bg-emerald-950 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">
                Join the course
              </p>
              <h2 className="mt-2 text-3xl font-black">Start a shared session</h2>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-black uppercase tracking-[0.16em] text-emerald-800">
                Display name
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-emerald-900/10 bg-white px-4 py-3 text-lg font-bold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                value={name}
                maxLength={28}
                placeholder="Your name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <button
              className="mt-5 w-full rounded-2xl bg-orange-500 px-5 py-4 text-lg font-black text-white shadow-xl shadow-orange-500/25 transition hover:-translate-y-0.5 hover:bg-orange-600"
              onClick={createRoom}
            >
              Create new room
            </button>

            <div className="my-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              or join
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-emerald-900/10 bg-white px-4 py-3 font-black uppercase outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                value={joinCode}
                maxLength={32}
                placeholder="ROOM42"
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    joinRoom()
                  }
                }}
              />
              <button
                className="rounded-2xl bg-emerald-950 px-5 py-3 font-black text-white transition hover:bg-emerald-800"
                onClick={joinRoom}
              >
                Join
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = new Uint8Array(6)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}
