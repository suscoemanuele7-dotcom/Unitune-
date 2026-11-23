import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ONBOARDING_KEY } from '../auth/AuthGate'
import { writeJson } from '../lib/storage'
import { t } from '../i18n'

export function OnboardingPage() {
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const slides = t.onboarding.slides
  const slide = slides[index] ?? slides[0]
  const last = index === slides.length - 1

  const finish = () => {
    writeJson(ONBOARDING_KEY, true)
    void navigate('/login', { replace: true })
  }

  return (
    <div className="pt-safe pb-safe flex h-dvh flex-col bg-gradient-to-b from-accent/30 via-bg to-bg px-6">
      <div className="flex justify-end pt-4">
        {!last && (
          <button type="button" onClick={finish} className="text-sm font-semibold text-muted hover:text-text">
            {t.onboarding.skip}
          </button>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-3xl shadow-2xl" />
        <div key={index} className="animate-slide-up space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">{slide.title}</h1>
          <p className="text-lg text-muted">{slide.body}</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md space-y-6 pb-8">
        <div className="flex justify-center gap-2" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-text' : 'w-1.5 bg-border'}`} />
          ))}
        </div>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            if (last) finish()
            else setIndex(index + 1)
          }}
        >
          {last ? t.onboarding.start : t.onboarding.next}
        </button>
      </div>
    </div>
  )
}
