import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import SearchBar from './SearchBar'

const fmt = iso => iso ? new Date(iso).toISOString().slice(0, 10) : ''
const PAGE_SIZES = [50, 100, 200]

export default function ProductTable({ refresh, printEnabled = true }) {
  const { t } = useT()
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [showDeleted, setShowDeleted] = useState(() => {
    try { return localStorage.getItem('showDeleted') === 'true' } catch { return false }
  })
  const [busy, setBusy] = useState({})
  const [pageSize, setPageSize] = useState(() => {
    try { return Number(localStorage.getItem('pageSize')) || 50 } catch { return 50 }
  })
  const [page, setPage] = useState(0)

  async function load() {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (showDeleted) params.set('include_deleted', 'true')
    const data = await apiFetch(`/products?${params}`)
    setProducts(data)
    setPage(0)
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

  const totalPages = Math.ceil(products.length / pageSize) || 1
  const safePage = Math.min(page, totalPages - 1)
  const visible = products.slice(safePage * pageSize, (safePage + 1) * pageSize)

  function changePageSize(n) {
    setPageSize(n)
    setPage(0)
    try { localStorage.setItem('pageSize', n) } catch {}
  }

  return (
    <div>
      <div className="table-toolbar">
        <SearchBar value={q} onChange={v => { setQ(v); setPage(0) }} />
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
              <th className="col-icon">{t('colIcon')}</th>
              <th>{t('colName')}</th>
              <th className="col-date">{t('colDate')}</th>
              <th className="col-status">{t('colStatus')}</th>
              <th>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => (
              <tr key={p.id} className={p.is_deleted ? 'deleted-row' : ''}>
                <td>{p.inventory_number}</td>
                <td className="col-icon"><img src={`/api/icons/${p.icon_filename}`} width={32} height={32} alt="" /></td>
                <td>{p.name}</td>
                <td className="col-date">{fmt(p.created_at)}</td>
                <td className="col-status">
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
            {visible.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center',color:'#888',padding:'2rem'}}>{t('noProducts')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span className="page-size-label">{t('pageSize')}</span>
        {PAGE_SIZES.map(n => (
          <button
            key={n}
            className={`page-size-btn${pageSize === n ? ' active' : ''}`}
            onClick={() => changePageSize(n)}
          >{n}</button>
        ))}
        <span className="page-spacer" />
        <button className="page-nav" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
          {t('pagePrev')}
        </button>
        <span className="page-info">{safePage + 1} / {totalPages}</span>
        <button className="page-nav" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
          {t('pageNext')}
        </button>
      </div>
    </div>
  )
}
