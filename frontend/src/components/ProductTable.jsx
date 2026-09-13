import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import SearchBar from './SearchBar'

const fmt = iso => iso ? new Date(iso).toISOString().slice(0, 10) : ''

export default function ProductTable({ refresh }) {
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
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
      if (p.print_warning) alert('Saved, but printing failed.')
    } finally {
      setBusy(b => ({ ...b, [id]: null }))
    }
  }

  async function del(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return
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
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          {' '}Show deleted
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Icon</th><th>Name</th><th>Date</th><th>Status</th><th>Actions</th>
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
                    ? <span className="status-deleted">Deleted by {p.deleted_by} on {fmt(p.deleted_at)}</span>
                    : <span className="status-active">Active</span>}
                </td>
                <td>
                  {!p.is_deleted && (
                    <>
                      <button onClick={() => reprint(p.id)} disabled={!!busy[p.id]}>
                        {busy[p.id] === 'reprint' ? '…' : 'Print'}
                      </button>
                      {' '}
                      <button className="btn-danger" onClick={() => del(p.id, p.name)} disabled={!!busy[p.id]}>
                        {busy[p.id] === 'delete' ? '…' : 'Delete'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center',color:'#888',padding:'2rem'}}>No products</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
