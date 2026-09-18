import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { formatPaise } from '@sv/shared';
import { adminApi, type AdminIdentity, type AdminProduct } from '../../api/admin';

/**
 * Catalogue management. Publishing is gated on an HSN code, because an
 * invoice without one is not GST-compliant — the server enforces it and this
 * screen explains why rather than just failing.
 */
const ProductRow: React.FC<{ product: AdminProduct; canPublish: boolean }> = ({ product, canPublish }) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.updateProduct(product.slug, body),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const onFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const { url } = await adminApi.uploadImage(file);
      await update.mutateAsync({ image: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const prices = product.variants.map((v) => v.pricePaise);
  const range =
    prices.length === 0
      ? '—'
      : prices.length === 1 || Math.min(...prices) === Math.max(...prices)
        ? formatPaise(prices[0]!)
        : `${formatPaise(Math.min(...prices))} – ${formatPaise(Math.max(...prices))}`;

  return (
    <tr className={product.published ? undefined : 'bg-[#B69A55]/8'}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <img src={product.image} alt="" className="w-10 h-10 rounded object-cover bg-[#F3E7D0]" />
          <div>
            <div className="font-medium">{product.name}</div>
            <div className="font-mono text-[11px] text-[#483828]/50">{product.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-[#483828]/70">{product.categoryLabel}</td>
      <td className="px-4 py-2.5 text-center tabular-nums">{product.variants.length}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{range}</td>
      <td className="px-4 py-2.5 text-center">
        {product.hsnCode ? (
          <span className="font-mono text-xs">{product.hsnCode}</span>
        ) : (
          <span className="text-[11px] text-[#87380F] font-semibold">missing</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <label className="text-[11px] px-2 py-1 border border-[#EBD9BC] rounded cursor-pointer hover:bg-[#F3E7D0]/50">
            {uploading ? 'Uploading…' : 'Image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>

          <button
            type="button"
            disabled={!canPublish || update.isPending || (!product.published && !product.hsnCode)}
            title={
              !canPublish
                ? 'Only an owner can publish'
                : !product.published && !product.hsnCode
                  ? 'An HSN code is required before publishing'
                  : undefined
            }
            onClick={() => { setError(null); update.mutate({ published: !product.published }); }}
            className={`text-[11px] px-2.5 py-1 rounded font-semibold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed ${
              product.published ? 'bg-[#647044]/15 text-[#42522a]' : 'bg-[#87380F] text-white'
            }`}
          >
            {product.published ? 'Live' : 'Publish'}
          </button>
        </div>
        {error && <p role="alert" className="text-[11px] text-[#87380F] mt-1 text-right">{error}</p>}
      </td>
    </tr>
  );
};

export const AdminProductsPage: React.FC = () => {
  const me = useOutletContext<AdminIdentity | undefined>();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'products'], queryFn: adminApi.products });

  return (
    <div className="bg-white border border-[#EBD9BC] rounded-lg overflow-x-auto">
      {isLoading ? (
        <p className="px-4 py-6 text-sm text-[#483828]/60" role="status">Loading catalogue…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/60">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Product</th>
              <th className="text-left px-4 py-2.5 font-semibold">Category</th>
              <th className="text-center px-4 py-2.5 font-semibold">Packs</th>
              <th className="text-right px-4 py-2.5 font-semibold">Price</th>
              <th className="text-center px-4 py-2.5 font-semibold">HSN</th>
              <th className="text-right px-4 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EBD9BC]">
            {data?.map((p) => (
              <ProductRow key={p.slug} product={p} canPublish={me?.role === 'owner'} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
