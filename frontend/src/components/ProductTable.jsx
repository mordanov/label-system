import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import SearchBar from './SearchBar'
import IconPickerPanel from './IconPickerPanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

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

  const [iconModal, setIconModal] = useState(null)
  const [pendingIcon, setPendingIcon] = useState('')
  const [iconSaving, setIconSaving] = useState(false)

  const [unitsEdit, setUnitsEdit] = useState(null)

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

  function openIconModal(product) {
    setIconModal(product)
    setPendingIcon(product.icon_filename)
  }

  async function saveIcon() {
    setIconSaving(true)
    try {
      const updated = await apiFetch(`/products/${iconModal.id}/icon`, {
        method: 'POST',
        body: JSON.stringify({ icon_filename: pendingIcon }),
      })
      setProducts(ps => ps.map(p => p.id === updated.id ? updated : p))
      setIconModal(null)
    } finally {
      setIconSaving(false)
    }
  }

  async function saveUnits(id, value) {
    const units = value === '' ? null : parseInt(value, 10)
    const updated = await apiFetch(`/products/${id}/units`, {
      method: 'POST',
      body: JSON.stringify({ units }),
    })
    setProducts(ps => ps.map(p => p.id === updated.id ? updated : p))
    setUnitsEdit(null)
  }

  function handleUnitsKey(e, id, value) {
    if (e.key === 'Enter') saveUnits(id, value)
    else if (e.key === 'Escape') setUnitsEdit(null)
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
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <SearchBar value={q} onChange={v => { setQ(v); setPage(0) }} />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={e => {
              try { localStorage.setItem('showDeleted', e.target.checked) } catch {}
              setShowDeleted(e.target.checked)
            }}
          />
          {t('showDeleted')}
        </label>
      </div>

      <div className="overflow-x-auto -webkit-overflow-scrolling-touch rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colNum')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('colIcon')}</TableHead>
              <TableHead>{t('colName')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('colUnits')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('colDate')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('colStatus')}</TableHead>
              <TableHead>{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(p => (
              <TableRow key={p.id} className={p.is_deleted ? 'opacity-50' : ''}>
                <TableCell>{p.inventory_number}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {!p.is_deleted ? (
                    <button
                      type="button"
                      className="rounded p-0.5 hover:outline hover:outline-2 hover:outline-primary opacity-85 hover:opacity-100 transition-opacity inline-flex"
                      onClick={() => openIconModal(p)}
                      title={t('changeIcon')}
                    >
                      <img src={`/api/icons/${p.icon_filename}`} width={32} height={32} alt="" />
                    </button>
                  ) : (
                    <img src={`/api/icons/${p.icon_filename}`} width={32} height={32} alt="" />
                  )}
                </TableCell>
                <TableCell className={p.is_deleted ? 'line-through' : ''}>{p.name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {!p.is_deleted && unitsEdit?.id === p.id ? (
                    <input
                      autoFocus
                      type="number" min={1}
                      className="w-16 px-1.5 py-0.5 border border-primary rounded text-xs text-center outline-none"
                      value={unitsEdit.value}
                      onChange={e => setUnitsEdit(u => ({ ...u, value: e.target.value }))}
                      onBlur={() => saveUnits(p.id, unitsEdit.value)}
                      onKeyDown={e => handleUnitsKey(e, p.id, unitsEdit.value)}
                    />
                  ) : (
                    <span
                      className={cn("flex items-center gap-1 min-w-[4rem]", !p.is_deleted && "cursor-pointer hover:text-primary hover:underline")}
                      onClick={!p.is_deleted ? () => setUnitsEdit({ id: p.id, value: p.units ?? '' }) : undefined}
                    >
                      {p.units ?? '—'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{fmt(p.created_at)}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {p.is_deleted
                    ? <Badge variant="secondary" className="text-muted-foreground">{t('statusDeletedBy', { by: p.deleted_by, on: fmt(p.deleted_at) })}</Badge>
                    : <Badge variant="outline" className="text-green-700 border-green-300">{t('statusActive')}</Badge>}
                </TableCell>
                <TableCell>
                  {!p.is_deleted && (
                    <div className="flex items-center gap-1">
                      {printEnabled && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => reprint(p.id)}
                          disabled={!!busy[p.id]}
                        >
                          {busy[p.id] === 'reprint' ? '…' : t('reprint')}
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => del(p.id, p.name)}
                        disabled={!!busy[p.id]}
                      >
                        {busy[p.id] === 'delete' ? '…' : t('deleteBtn')}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('noProducts')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-3 text-sm text-foreground">
        <span className="text-muted-foreground mr-1">{t('pageSize')}</span>
        {PAGE_SIZES.map(n => (
          <button
            key={n}
            className={cn(
              "px-2 py-1 rounded border text-xs transition-colors",
              pageSize === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-accent"
            )}
            onClick={() => changePageSize(n)}
          >{n}</button>
        ))}
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
          {t('pagePrev')}
        </Button>
        <span className="min-w-[4rem] text-center text-muted-foreground">{safePage + 1} / {totalPages}</span>
        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
          {t('pageNext')}
        </Button>
      </div>

      {iconModal && (
        <div
          className="fixed inset-0 bg-black/45 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setIconModal(null) }}
        >
          <div className="bg-background rounded-xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto relative shrink-0 p-6">
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground leading-none p-1"
              onClick={() => setIconModal(null)}
            >✕</button>
            <h2 className="font-semibold mb-4 pr-8">{t('changeIcon')} — {iconModal.name}</h2>
            <IconPickerPanel value={pendingIcon} onChange={setPendingIcon} productName={iconModal.name} />
            <div className="mt-4 flex justify-end">
              <Button onClick={saveIcon} disabled={iconSaving}>
                {iconSaving ? t('saving') : t('labelSave')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
