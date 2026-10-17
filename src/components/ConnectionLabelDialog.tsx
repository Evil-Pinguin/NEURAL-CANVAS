import { useRef, useState, type FormEvent } from 'react'
import { Pencil, X } from 'lucide-react'
import type { CanvasEdgeData } from '../domain/model'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import { useWorkspaceStore } from '../store/workspace-store'

type ConnectionLabelDialogProps = {
  edge: CanvasEdgeData
  onClose: () => void
}

export default function ConnectionLabelDialog({ edge, onClose }: ConnectionLabelDialogProps) {
  const [draft, setDraft] = useState(edge.label)
  const dialogRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateEdgeLabel = useWorkspaceStore((state) => state.updateEdgeLabel)
  const normalizedDraft = draft.trim()
  const isValid = normalizedDraft.length > 0 && normalizedDraft.length <= 80
  const hasChanged = normalizedDraft !== edge.label

  useDialogAccessibility(dialogRef, () => inputRef.current, onClose)

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValid || !hasChanged) return
    updateEdgeLabel(edge.id, normalizedDraft)
    onClose()
  }

  return (
    <div
      className="import-dialog-backdrop connection-label-dialog-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        ref={dialogRef}
        className="import-dialog connection-label-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-label-dialog-title"
        aria-describedby="connection-label-dialog-description"
        tabIndex={-1}
      >
        <div className="import-dialog__header">
          <span className="import-dialog__icon"><Pencil size={16} aria-hidden="true" /></span>
          <div>
            <span className="import-dialog__eyebrow">ПОДПИСЬ СВЯЗИ</span>
            <h2 id="connection-label-dialog-title">Переименовать связь</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть окно переименования" title="Закрыть окно переименования" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <p id="connection-label-dialog-description" className="import-dialog__summary">
          Изменится только текстовая подпись. Тип отношения и смысл связи останутся прежними.
        </p>

        <form onSubmit={save}>
          <label className="connection-label-dialog__field">
            <span>Подпись связи</span>
            <input
              ref={inputRef}
              className="connection-label-dialog__input"
              type="text"
              value={draft}
              maxLength={80}
              aria-invalid={!isValid}
              aria-describedby="connection-label-dialog-hint"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <p id="connection-label-dialog-hint" className={`connection-label-dialog__hint${isValid ? '' : ' is-error'}`} role="status">
            {isValid ? `${draft.length} из 80 символов` : 'Введите подпись длиной не более 80 символов.'}
          </p>
          <div className="import-dialog__actions">
            <button className="import-dialog__cancel" type="button" onClick={onClose}>Отмена</button>
            <button className="import-dialog__primary" type="submit" disabled={!isValid || !hasChanged}>Сохранить подпись</button>
          </div>
        </form>
      </section>
    </div>
  )
}
