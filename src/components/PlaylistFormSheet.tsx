import { useId, useState, type SubmitEvent } from 'react'
import type { PlaylistInput } from '../types'
import { BottomSheet } from './BottomSheet'
import { t } from '../i18n'

interface PlaylistFormSheetProps {
  open: boolean
  initial?: PlaylistInput
  onClose: () => void
  onSubmit: (input: PlaylistInput) => Promise<void>
}

const blank: PlaylistInput = { name: '', description: '', isPublic: false, isUniversity: false }

export function PlaylistFormSheet({ open, initial, onClose, onSubmit }: PlaylistFormSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={initial ? t.playlist.form.editTitle : t.playlist.form.createTitle}>
      {/* Il form si rimonta a ogni apertura: stato sempre pulito. */}
      {open && <PlaylistForm initial={initial ?? blank} isEdit={Boolean(initial)} onClose={onClose} onSubmit={onSubmit} />}
    </BottomSheet>
  )
}

function PlaylistForm({
  initial,
  isEdit,
  onClose,
  onSubmit,
}: {
  initial: PlaylistInput
  isEdit: boolean
  onClose: () => void
  onSubmit: (input: PlaylistInput) => Promise<void>
}) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const nameId = useId()
  const descId = useId()

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!value.name.trim() || busy) return
    setBusy(true)
    try {
      await onSubmit({ ...value, isPublic: value.isPublic || value.isUniversity })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 px-2 pt-2">
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="text-sm font-medium">
          {t.playlist.form.name}
        </label>
        <input
          id={nameId}
          className="input"
          required
          maxLength={100}
          autoFocus
          placeholder={t.playlist.form.namePlaceholder}
          value={value.name}
          onChange={(e) => {
            setValue({ ...value, name: e.target.value })
          }}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={descId} className="text-sm font-medium">
          {t.playlist.form.description}
        </label>
        <textarea
          id={descId}
          className="input min-h-20 resize-none"
          maxLength={300}
          value={value.description}
          onChange={(e) => {
            setValue({ ...value, description: e.target.value })
          }}
        />
      </div>
      <Toggle
        label={t.playlist.form.isPublic}
        hint={t.playlist.form.isPublicHint}
        checked={value.isPublic || value.isUniversity}
        disabled={value.isUniversity}
        onChange={(isPublic) => {
          setValue({ ...value, isPublic })
        }}
      />
      <Toggle
        label={t.playlist.form.isUniversity}
        hint={t.playlist.form.isUniversityHint}
        checked={value.isUniversity}
        onChange={(isUniversity) => {
          setValue({ ...value, isUniversity })
        }}
      />
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>
          {t.playlist.form.cancel}
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={!value.name.trim() || busy}>
          {isEdit ? t.playlist.form.save : t.playlist.form.create}
        </button>
      </div>
    </form>
  )
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : ''}`}>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.checked)
        }}
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-border transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
      />
    </label>
  )
}
