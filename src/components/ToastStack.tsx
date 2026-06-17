export interface ToastMessage {
  id: string
  tone: 'info' | 'success' | 'error'
  text: string
}

interface ToastStackProps {
  toasts: ToastMessage[]
}

const toneClass = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed right-4 top-20 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl shadow-emerald-950/10 ${toneClass[toast.tone]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  )
}
