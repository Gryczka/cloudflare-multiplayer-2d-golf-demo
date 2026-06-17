import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ChatPanel } from '../components/ChatPanel'
import { GameSummary } from '../components/GameSummary'
import { GolfCanvas } from '../components/GolfCanvas'
import { LeaderboardPanel } from '../components/LeaderboardPanel'
import { RoomSidebar } from '../components/RoomSidebar'
import { Scoreboard } from '../components/Scoreboard'
import { ShotHud } from '../components/ShotHud'
import { ToastStack, type ToastMessage } from '../components/ToastStack'
import { DEFAULT_COURSE_ID, getHole } from '../game/courses'
import { currentStrokeCopy, formatScoreToPar, totalScoreToPar } from '../game/scoring'
import type { AimState, Role } from '../game/types'
import { useGolfRoom } from '../hooks/useGolfRoom'

export const Route = createFileRoute('/room/$roomId')({ component: Room })

interface Identity {
  name: string
  role: Role
}

function Room() {
  const { roomId } = Route.useParams()
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftRole, setDraftRole] = useState<Role>('golfer')
  const [aim, setAim] = useState<AimState | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [roleToastShown, setRoleToastShown] = useState(false)
  const client = useGolfRoom(roomId, identity?.name ?? '', identity?.role ?? 'golfer')
  const state = client.state
  const hole = state ? getHole(state.courseId, state.holeIndex) : getHole(DEFAULT_COURSE_ID, 0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const name = params.get('name') || window.localStorage.getItem('golf:name') || ''
    if (name) {
      setDraftName(name)
      setIdentity({ name, role: 'golfer' })
    }
  }, [])

  useEffect(() => {
    setAim(null)
  }, [state?.currentTurn, state?.holeIndex])

  useEffect(() => {
    if (!client.error) {
      return
    }
    addToast('error', client.error)
  }, [client.error])

  const currentPlayer = state?.players.find((player) => player.id === client.playerId) ?? null
  const currentScoreToPar = currentPlayer
    ? totalScoreToPar(currentPlayer.strokes, state?.holePars ?? [])
    : 0
  const activeTurnName = useMemo(() => {
    if (!state) {
      return 'Waiting for room state...'
    }
    if (state.status === 'lobby') {
      return 'Waiting in the lobby'
    }
    if (state.status === 'finished') {
      return 'Game finished'
    }
    const turnPlayer = state.players.find((player) => player.id === state.currentTurn)
    return turnPlayer ? `${turnPlayer.name}'s turn` : 'Waiting for next turn'
  }, [state])

  const canShoot =
    Boolean(state) &&
    state?.status === 'playing' &&
    state.currentTurn === client.playerId &&
    currentPlayer?.role === 'golfer' &&
    !currentPlayer.inHole &&
    !currentPlayer.pickedUp &&
    !client.activeShot

  useEffect(() => {
    if (!state || !identity || !currentPlayer || roleToastShown) {
      return
    }
    if (identity.role === 'golfer' && currentPlayer.role === 'spectator') {
      setRoleToastShown(true)
      addToast('info', 'The foursome is full, so you joined as a spectator.')
    }
  }, [currentPlayer, identity, roleToastShown, state])

  function addToast(tone: ToastMessage['tone'], text: string) {
    const toast = { id: crypto.randomUUID(), tone, text }
    setToasts((current) => [...current, toast].slice(-4))
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== toast.id))
    }, 3600)
  }

  const join = () => {
    const clean = draftName.trim() || 'Guest golfer'
    window.localStorage.setItem('golf:name', clean)
    setIdentity({ name: clean, role: draftRole })
  }

  if (!identity) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7ed] px-6 py-20 text-emerald-950">
        <section className="w-full max-w-md rounded-[2rem] border border-emerald-900/10 bg-white p-6 shadow-2xl shadow-emerald-950/15">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-900/70 transition hover:bg-orange-100 hover:text-orange-700"
          >
            <ArrowLeft size={14} /> Main menu
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-600">Room {roomId}</p>
          <h1 className="mt-2 text-3xl font-black">Choose how to join</h1>
          <input
            className="mt-6 w-full rounded-2xl border border-emerald-900/10 px-4 py-3 text-lg font-bold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            value={draftName}
            maxLength={28}
            placeholder="Your display name"
            onChange={(event) => setDraftName(event.target.value)}
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['golfer', 'spectator'] as const).map((role) => (
              <button
                key={role}
                className={`rounded-2xl px-4 py-3 font-black capitalize transition ${
                  draftRole === role
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-orange-100'
                }`}
                onClick={() => setDraftRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
          <button
            className="mt-5 w-full rounded-2xl bg-emerald-950 px-5 py-4 font-black text-white transition hover:bg-emerald-800"
            onClick={join}
          >
            Enter room
          </button>
        </section>
      </main>
    )
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7ed] px-6 py-20 text-emerald-950">
        <section className="rounded-[2rem] border border-emerald-900/10 bg-white p-8 text-center shadow-2xl shadow-emerald-950/15">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-600">Connecting</p>
          <h1 className="mt-2 text-3xl font-black">Opening room {roomId}</h1>
          <p className="mt-3 font-semibold text-slate-600">{client.status}</p>
          {client.error ? <p className="mt-3 font-bold text-red-600">{client.error}</p> : null}
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-900/70 transition hover:bg-orange-100 hover:text-orange-700"
          >
            <ArrowLeft size={14} /> Main menu
          </Link>
        </section>
      </main>
    )
  }

  const inLobby = state.status === 'lobby'

  return (
    <main className="min-h-screen bg-[#fff7ed] px-4 py-20 text-emerald-950 sm:px-6">
      <ToastStack toasts={toasts} />
      <div className="mx-auto max-w-[1500px]">
        <GameSummary state={state} onPlayAgain={client.playAgain} />
        <div className="mb-6 rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-xl shadow-emerald-950/10 backdrop-blur">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-900/70 transition hover:bg-orange-100 hover:text-orange-700"
          >
            <ArrowLeft size={14} /> Main menu
          </Link>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-600">
                {state.courseName}
              </p>
              <h1 className="mt-1 text-3xl font-black sm:text-5xl">
                Hole {state.holeIndex + 1}: {hole.name}
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-900/70">{hole.note}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-emerald-950 px-5 py-3 text-white">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Par</p>
                <p className="text-2xl font-black">{hole.par}</p>
              </div>
              <div className="rounded-2xl bg-orange-100 px-5 py-3 text-orange-950">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">Your score</p>
                <p className="text-2xl font-black">{formatScoreToPar(currentScoreToPar)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <section
            className={`space-y-6 ${
              inLobby ? 'order-2' : 'order-1'
            } xl:order-none xl:col-start-1 xl:row-start-1 xl:row-span-2`}
          >
            <GolfCanvas
              hole={hole}
              state={state}
              playerId={client.playerId}
              aim={aim}
              activeShot={client.activeShot}
              cursors={client.cursors}
              reactions={client.reactions}
              canAim={canShoot}
              onAimChange={setAim}
              onCursorMove={(point) => client.sendCursor(point.x, point.y)}
              onReact={client.sendReaction}
              hud={
                <ShotHud
                  aim={aim}
                  canShoot={canShoot}
                  statusText={activeTurnName}
                  helperText={currentStrokeCopy(currentPlayer, hole, state.holeIndex)}
                  onShoot={() => {
                    if (!aim) {
                      return
                    }
                    client.takeShot(aim)
                    setAim(null)
                  }}
                />
              }
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <Scoreboard state={state} />
              <ChatPanel messages={state.chat} onSend={client.sendChat} />
            </div>
          </section>

          <div
            className={`${
              inLobby ? 'order-1' : 'order-2'
            } xl:order-none xl:col-start-2 xl:row-start-1`}
          >
            <RoomSidebar
              state={state}
              playerId={client.playerId}
              connectionStatus={client.status}
              onStartGame={client.startGame}
            />
          </div>

          <section className="order-3 space-y-6 xl:order-none xl:col-start-2 xl:row-start-2">
            <LeaderboardPanel entries={state.leaderboard} />
          </section>
        </div>
      </div>
    </main>
  )
}
