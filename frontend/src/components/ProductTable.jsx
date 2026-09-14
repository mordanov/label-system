import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import SearchBar from './SearchBar'

const fmt = iso => iso ? new Date(iso).toISOString().slice(0, 10) : ''

export default function ProductTable({ refresh, printEnabled = true }) {
  const { t } = useT()
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [showDeleted, setShowDeleted] = useState(() => {
    try { return localStorage.getItem('showDeleted') === 'true' } catch { return false }
  })
  const [busy, setBusy] = useState({})

  async function load() {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (showDeleted) params.set('include_deleted', 'true')
    const data = await apiFetch(`/products?${params}`)
    setProducts(data)
  }

  useEffect(() => { load() }, [refresh, q, showDeleted])

  async function reprint(id) {
    setBusy(b => ({ ...b, [id]: 'reprint' }))
    try {
      const p = await apiFetch(`/products/${id}/reprint`, { method: 'POST' })
      if (p.print_warning) alert(t('reprintFailed'))
    } finally {
      setBusy(b => ({ ...b, [id]: null }))
    }
  }

  async function del(id, name) {
    if (!window.confirm(t('confirmDelete', { name }))) return
    setBusy(b => ({ ...b, [id]: 'delete' }))
    try {
      await apiFetch(`/products/${id}/delete`, { method: 'POST' })
      load()
    } finally {
      setBusy(b => ({ ...b, [id]: null }))
    }
  }

  return (
    <div>
      <div className="table-toolbar">
        <SearchBar value={q} onChange={setQ} />
        <label className="toggle-deleted">
          <input type="checkbox" checked={showDeleted} onChange={e => {
              try { localStorage.setItem('showDeleted', e.target.checked) } catch {}
              setShowDeleted(e.target.checked)
            }} />
          {' '}{t('showDeleted')}
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('colNum')}</th>
              <th>{t('colIcon')}</th>
              <th>{t('colName')}</th>
              <th>{t('colDate')}</th>
              <th>{t('colStatus')}</th>
              <th>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className={p.is_deleted ? 'deleted-row' : ''}>
                <td>{p.inventory_number}</td>
                <td><img src={`/api/icons/${p.icon_filename}`} width={32} height={32} alt="" /></td>
                <td>{p.name}</td>
                <td>{fmt(p.created_at)}</td>
                <td>
                  {p.is_deleted
                    ? <span className="status-deleted">{t('statusDeletedBy', { by: p.deleted_by, on: fmt(p.deleted_at) })}</span>
                    : <span className="status-active">{t('statusActive')}</span>}
                </td>
                <td>
                  {!p.is_deleted && (
                    <>
                      {printEnabled && (
                        <>
                          <button onClick={() => reprint(p.id)} disabled={!!busy[p.id]}>
                            {busy[p.id] === 'reprint' ? '…' : t('reprint')}
                          </button>
                          {' '}
                        </>
                      )}
                      <button className="btn-danger" onClick={() => del(p.id, p.name)} disabled={!!busy[p.id]}>
                        {busy[p.id] === 'delete' ? '…' : t('deleteBtn')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center',color:'#888',padding:'2rem'}}>{t('noProducts')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
