import { useRef, useState } from 'react'
import { AlertTriangle, ArrowDownToLine, Layers3, Loader2, X } from 'lucide-react'
import type { Workspace } from '../domain/model'
import type { WorkspaceImportMode } from '../store/workspace-store'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'

type ImportWorkspaceDialogProps = {
  fileName: string
  currentWorkspaceName: string
  workspace?: Workspace
  legacy?: boolean
  error?: string
  actionError?: string | null
  isWorking?: boolean
  onCancel: () => void
  onConfirm: (mode: WorkspaceImportMode) => void
}

export default function ImportWorkspaceDialog({
  fileName,
  currentWorkspaceName,
  workspace,
  legacy = false,
  error,
  actionError,
  isWorking = false,
  onCancel,
  onConfirm,
}: ImportWorkspaceDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const mergeRadioRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<WorkspaceImportMode>('merge')
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)

  useDialogAccessibility(
    dialogRef,
    () => (error || !workspace ? closeButtonRef.current : mergeRadioRef.current) ?? closeButtonRef.current,
    onCancel,
    true,
    () => !isWorking,
  )

  return (
    <div className="import-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isWorking) onCancel() }}>
      <section
        ref={dialogRef}
        className="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        aria-describedby={error ? 'import-dialog-error' : actionError ? 'import-dialog-description import-action-error' : 'import-dialog-description'}
        aria-busy={isWorking}
        tabIndex={-1}
      >
        <div className="import-dialog__header">
          <span className={`import-dialog__icon${error ? ' is-error' : ''}`}>{error ? <AlertTriangle size={17} /> : <ArrowDownToLine size={17} />}</span>
          <div>
            <span className="import-dialog__eyebrow">РЕЗЕРВНАЯ КОПИЯ</span>
            <h2 id="import-dialog-title">{error ? 'Не удалось импортировать файл' : 'Импорт рабочего пространства'}</h2>
          </div>
          <button ref={closeButtonRef} className="icon-button" type="button" aria-label="Закрыть окно импорта" title="Закрыть окно импорта" disabled={isWorking} onClick={onCancel}><X size={15} /></button>
        </div>

        {error ? (
          <div id="import-dialog-error" className="import-dialog__error" role="alert">
            <strong>Данные не изменены.</strong>
            <p>{error}</p>
          </div>
        ) : workspace ? (
          <>
            <div className="import-dialog__file">
              <span className="import-dialog__file-icon"><Layers3 size={15} /></span>
              <span><strong>{workspace.name}</strong><small>{fileName}{legacy ? ' · устаревший формат JSON без версии' : ' · резервная копия JSON с номером версии'}</small></span>
            </div>
            <p id="import-dialog-description" className="import-dialog__summary">
              Узлов: {workspace.nodes.length} · связей: {workspace.edges.length} · архитектурных заметок: {workspace.architectureNotes.length} · настройки и избранное тоже сохранены
            </p>

            <fieldset className="import-dialog__choices">
              <legend>Что сделать с этой резервной копией?</legend>
              <label className={`import-dialog__choice${mode === 'merge' ? ' is-selected' : ''}`}>
                <input ref={mergeRadioRef} type="radio" name="workspace-import-mode" value="merge" checked={mode === 'merge'} disabled={isWorking} onChange={() => { setMode('merge'); setReplaceConfirmed(false) }} />
                <span><strong>Объединить с текущим пространством</strong><small>Добавить записи из копии, сохранить текущие настройки и данные, переименовать конфликтующие идентификаторы.</small></span>
              </label>
              <label className={`import-dialog__choice${mode === 'replace' ? ' is-selected' : ''}`}>
                <input type="radio" name="workspace-import-mode" value="replace" checked={mode === 'replace'} disabled={isWorking} onChange={() => { setMode('replace'); setReplaceConfirmed(false) }} />
                <span><strong>Заменить текущее пространство</strong><small>Заменить «{currentWorkspaceName}» данными из «{workspace.name}».</small></span>
              </label>
            </fieldset>

            {mode === 'replace' && (
              <div className="import-dialog__replace-warning">
                <p><AlertTriangle size={14} /> Замена перезапишет текущее рабочее пространство. Перед этим будет создана резервная копия на устройстве.</p>
                <label><input type="checkbox" checked={replaceConfirmed} disabled={isWorking} onChange={(event) => setReplaceConfirmed(event.target.checked)} /> Понимаю, заменить это рабочее пространство.</label>
              </div>
            )}

            {actionError && <div id="import-action-error" className="import-dialog__error" role="alert"><strong>Импорт не выполнен.</strong><p>{actionError}</p></div>}
            <p className="import-dialog__privacy">Файл проверяется на этом устройстве до сохранения. Код из файла не запускается.</p>
          </>
        ) : null}

        <div className="import-dialog__actions">
          {error ? (
            <button className="import-dialog__primary" onClick={onCancel}>Закрыть</button>
          ) : (
            <>
              <button className="import-dialog__cancel" disabled={isWorking} onClick={onCancel}>Отмена</button>
              <button
                type="button"
                className={`import-dialog__primary${mode === 'replace' ? ' is-danger' : ''}`}
                disabled={isWorking || (mode === 'replace' && !replaceConfirmed)}
                aria-busy={isWorking}
                onClick={() => onConfirm(mode)}
              >
                {isWorking && <Loader2 size={14} className="design-system-spinner" aria-hidden="true" />}
                {isWorking ? 'Импорт…' : mode === 'replace' ? 'Подтвердить замену' : 'Объединить данные'}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
