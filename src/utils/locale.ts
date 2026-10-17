export type RussianPluralForms = {
  one: string
  few: string
  many: string
}

const russianPluralRules = new Intl.PluralRules('ru-RU')
const russianNumberFormatter = new Intl.NumberFormat('ru-RU')

export function formatRussianCount(value: number, forms: RussianPluralForms): string {
  const category = russianPluralRules.select(value)
  const noun = category === 'one' ? forms.one : category === 'few' ? forms.few : forms.many
  return `${russianNumberFormatter.format(value)} ${noun}`
}

export function formatRussianDate(value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата неизвестна'
  return new Intl.DateTimeFormat('ru-RU', options).format(date)
}

export const flowAriaLabelConfig = {
  'node.a11yDescription.default': 'Узел графа. Нажмите Enter, чтобы выбрать его, и пробел, чтобы начать перемещение.',
  'node.a11yDescription.keyboardDisabled': 'Узел графа. Клавиатурное управление графом отключено.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }: { direction: string; x: number; y: number }) => {
    const directions: Record<string, string> = { left: 'влево', right: 'вправо', up: 'вверх', down: 'вниз' }
    return `Узел перемещён ${directions[direction] ?? direction}. Координаты: ${Math.round(x)}, ${Math.round(y)}.`
  },
  'edge.a11yDescription.default': 'Связь между узлами графа.',
  'controls.ariaLabel': 'Управление графом',
  'controls.zoomIn.ariaLabel': 'Приблизить граф',
  'controls.zoomOut.ariaLabel': 'Отдалить граф',
  'controls.fitView.ariaLabel': 'Показать граф целиком',
  'controls.interactive.ariaLabel': 'Включить или выключить взаимодействие с графом',
  'minimap.ariaLabel': 'Мини-карта графа',
  'handle.ariaLabel': 'Точка соединения узла. Перетащите её к другому узлу, чтобы создать связь.',
} satisfies Partial<import('@xyflow/react').AriaLabelConfig>
