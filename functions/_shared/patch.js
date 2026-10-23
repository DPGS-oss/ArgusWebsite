/** A record list in appData (records have ids), as opposed to settings and the like. */
const isRecordList = (v) => Array.isArray(v) && v.some((r) => r && typeof r === 'object' && r.id != null);

/**
 * A save that sends only what changed: `changes` (records added or edited, by
 * list), `removed` (ids this device dropped), `small` (settings and other
 * small parts, whole), `deleted` (tombstones) and new edit-log lines. Applied
 * record by record onto what is stored, so another device's changes stay.
 */
function applyPatch(stored, body) {
  const out = { ...(stored || {}) };
  const changes = body.changes && typeof body.changes === 'object' ? body.changes : {};
  const removed = body.removed && typeof body.removed === 'object' ? body.removed : {};
  for (const key of new Set([...Object.keys(changes), ...Object.keys(removed)])) {
    if (key === 'auditLog' || key === 'deleted') continue;
    const list = Array.isArray(out[key]) ? out[key] : [];
    const index = new Map(list.map((r, i) => [String(r && r.id), i]));
    const next = [...list];
    for (const r of Array.isArray(changes[key]) ? changes[key] : []) {
      if (!r || r.id == null) continue;
      const i = index.get(String(r.id));
      if (i === undefined) index.set(String(r.id), next.push(r) - 1);
      else next[i] = r;
    }
    const gone = new Set((Array.isArray(removed[key]) ? removed[key] : []).map(String));
    out[key] = gone.size ? next.filter((r) => !gone.has(String(r && r.id))) : next;
  }
  const small = body.small && typeof body.small === 'object' ? body.small : {};
  for (const [k, v] of Object.entries(small)) if (!isRecordList(out[k]) && k !== 'auditLog' && k !== 'deleted') out[k] = v;
  // Tombstones only grow; a tombstoned record goes from its list.
  const deleted = { ...(out.deleted || {}) };
  for (const [k, ids] of Object.entries(body.deleted && typeof body.deleted === 'object' ? body.deleted : {})) {
    deleted[k] = { ...(deleted[k] || {}), ...(ids || {}) };
    if (Array.isArray(out[k])) out[k] = out[k].filter((r) => !deleted[k][String(r && r.id)]);
  }
  out.deleted = deleted;
  return out;
}

module.exports = { applyPatch, isRecordList };
