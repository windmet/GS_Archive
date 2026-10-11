// Presentation keys follow the photo script's actual motion / face tokens.
// They never replace source preset IDs in saved compositions.
export const STUDIO_PRESET_LABELS = Object.freeze({
  faces: Object.freeze({
    default: '自然', joy: '喜悦', happy: '开心', angry: '生气', sad: '难过',
    serious: '认真', shy: '害羞', surprise: '惊讶', swet: '冒汗',
    think: '思考', trouble: '困扰', grave: '严肃', satan: '撒旦', EX: '特殊 EX',
  }),
  poses: Object.freeze({
    wait_loop: '自然站姿', weight: '重心调整', angry: '生气', hello: '招呼',
    joy: '喜悦', sad: '失落', surprise: '惊讶', brushing: '整理仪容',
    hurrah: '欢呼', satan_on: '撒旦登场',
  }),
  neck: Object.freeze({ neck_question: '歪头', neck_lookup: '抬头' }),
});

export function studioPresetPresentation(view, kind, row) {
  const rows = [...(view?.actor?.[kind] || [])]
    .sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
  const number = String(Math.max(0, rows.findIndex(candidate => candidate.id === row.id)) + 1).padStart(2, '0');
  const preset = view?.media?.entries?.[`${kind}:${row.id}`]?.preset;
  const source = String(kind === 'faces'
    ? (preset?.face || row.iconResourceId || '').replace(/^face_/, '')
    : preset?.motion || '');
  const base = kind === 'faces' ? source.replace(/_evolution$/, '') : source;
  const labels = STUDIO_PRESET_LABELS[kind];
  const known = Object.hasOwn(labels, base);
  let label = known ? labels[base] : `${kind === 'faces' ? '表情' : '动作'} ${number}`;
  if (known && kind === 'faces' && source.endsWith('_evolution')) label += ' · 变化版';
  if (kind === 'poses' && preset?.neck) label += ` · ${STUDIO_PRESET_LABELS.neck[preset.neck] || preset.neck}`;
  return {
    key: `${kind}:${source || row.id}${kind === 'poses' && preset?.neck ? `:${preset.neck}` : ''}`,
    label, number, source, known,
  };
}
