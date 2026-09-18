import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { Upload, Info } from 'lucide-react';
import { formatPaise } from '@sv/shared';
import { adminApi, type AdminIdentity, type AdminProduct } from '../api/client';
import { PageHeader, Card, FilterTabs, SearchField } from '../components/ui/Layout';
import { SkeletonTable, SkeletonCards, EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';

/**
 * Publishing is gated on an HSN code — an invoice without one is not
 * GST-compliant. The toggle is disabled with the reason rather than allowing
 * a click that fails. See docs/COMPLIANCE.md §4.
 */
const PublishToggle: React.FC<{ product: AdminProduct; canPublish: boolean }> = ({ product, canPublish }) => {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const toggle = useMutation({
    mutationFn: (published: boolean) => adminApi.updateProduct(product.slug, { published }),
    onSuccess: (_r, published) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      notify({ tone: 'success', title: published ? `${product.name} is live.` : `${product.name} unpublished.` });
    },
    onError: (e: Error) => notify({ tone: 'error', title: "Couldn't update product", detail: e.message }),
  });

  const blockedByHsn = !product.published && !product.hsnCode;
  const disabled = !canPublish || blockedByHsn || toggle.isPending;
  const reason = !canPublish
    ? 'Only owners can publish'
    : blockedByHsn
      ? 'Add an HSN code to enable publishing'
      : undefined;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={product.published}
        aria-label={`${product.published ? 'Unpublish' : 'Publish'} ${product.name}`}
        title={reason}
        disabled={disabled}
        onClick={() => toggle.mutate(!product.published)}
        // The switch reads as 24px but the tap target is a full 44px —
        // the visual track sits inside a taller button.
        className="grid place-items-center min-h-11 min-w-11 shrink-0 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative flex h-6 w-11 items-center rounded-full transition-colors',
            product.published ? 'bg-[#87380F]' : 'bg-[#483828]/20',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full bg-white transition-transform',
              product.published ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </span>
      </button>
      <span className="text-[11px] font-semibold">
        {product.published ? (
          <span className="text-[#647044]">Published</span>
        ) : blockedByHsn ? (
          <span className="text-[#A33A28] inline-flex items-center gap-1">
            <Info size={11} aria-hidden="true" /> Missing HSN
          </span>
        ) : (
          <span className="text-[#483828]/55">Draft</span>
        )}
      </span>
    </span>
  );
};

const ImageUpload: React.FC<{ product: AdminProduct }> = ({ product }) => {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const { url } = await adminApi.uploadImage(file);
      await adminApi.updateProduct(product.slug, { image: url });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      notify({ tone: 'success', title: 'Image updated.' });
    } catch (e) {
      notify({ tone: 'error', title: 'Upload failed', detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border border-[#EBD9BC] text-[11px] font-semibold cursor-pointer hover:bg-[#F3E7D0]/60">
      <Upload size={13} aria-hidden="true" />
      {busy ? 'Uploading…' : 'Image'}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
};

export const AdminProductsPage: React.FC = () => {
  const me = useOutletContext<AdminIdentity | undefined>();
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: adminApi.products,
  });

  const all = data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (filter === 'published' && !p.published) return false;
      if (filter === 'draft' && p.published) return false;
      if (filter === 'nohsn' && p.hsnCode) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.slug.includes(q) || p.categoryLabel.toLowerCase().includes(q);
    });
  }, [all, filter, search]);

  const priceRange = (p: AdminProduct) => {
    const prices = p.variants.map((v) => v.pricePaise);
    if (prices.length === 0) return '—';
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? formatPaise(min) : `${formatPaise(min)} – ${formatPaise(max)}`;
  };

  return (
    <>
      <PageHeader title="Products" subtitle="Manage your catalogue. Keep your range fresh and findable." />

      <div className="flex flex-col gap-3 mb-4">
        <SearchField
          value={search} onChange={setSearch} id="product-search"
          placeholder="Search products by name, slug or category…"
        />
        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: '', label: 'All', count: all.length },
            { value: 'published', label: 'Published', count: all.filter((p) => p.published).length },
            { value: 'draft', label: 'Draft', count: all.filter((p) => !p.published).length },
            { value: 'nohsn', label: 'Missing HSN', count: all.filter((p) => !p.hsnCode).length },
          ]}
        />
      </div>

      {isLoading ? (
        <>
          <Card className="hidden lg:block"><SkeletonTable cols={5} /></Card>
          <div className="lg:hidden"><SkeletonCards /></div>
        </>
      ) : isError ? (
        <Card><ErrorState title="Couldn't load products" onRetry={() => refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No products match"
            hint="Try a different filter or search term."
            actions={<Button variant="secondary" onClick={() => { setFilter(''); setSearch(''); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="hidden lg:block overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Products</caption>
              <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/55">
                <tr>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Product</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Category</th>
                  <th scope="col" className="text-center px-4 py-2.5 font-semibold">Packs</th>
                  <th scope="col" className="text-right px-4 py-2.5 font-semibold">Price</th>
                  <th scope="col" className="text-center px-4 py-2.5 font-semibold">HSN</th>
                  <th scope="col" className="text-right px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBD9BC]">
                {rows.map((p) => (
                  <tr key={p.slug} className={cn('hover:bg-[#F3E7D0]/40', !p.published && 'bg-[#B69A55]/6')}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt="" className="w-9 h-9 rounded object-cover bg-[#F3E7D0]" />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="font-mono text-[11px] text-[#483828]/45">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[#483828]/70">{p.categoryLabel}</td>
                    <td className="px-4 py-2 text-center tabular">{p.variants.length}</td>
                    <td className="px-4 py-2 text-right tabular">{priceRange(p)}</td>
                    <td className="px-4 py-2 text-center font-mono text-xs">
                      {p.hsnCode ?? <span className="text-[#A33A28] font-sans font-semibold">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <ImageUpload product={p} />
                        <PublishToggle product={p} canPublish={me?.role === 'owner'} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="lg:hidden space-y-2.5">
            {rows.map((p) => (
              <li key={p.slug} className={cn('rounded-lg border border-[#EBD9BC] bg-white p-3.5', !p.published && 'bg-[#B69A55]/6')}>
                <div className="flex items-start gap-3">
                  <img src={p.image} alt="" className="w-11 h-11 rounded object-cover bg-[#F3E7D0] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="font-mono text-[11px] text-[#483828]/45">{p.slug}</p>
                    <p className="tabular text-xs text-[#483828]/70 mt-0.5">
                      {priceRange(p)} · {p.variants.length} pack{p.variants.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <ImageUpload product={p} />
                  <PublishToggle product={p} canPublish={me?.role === 'owner'} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};
