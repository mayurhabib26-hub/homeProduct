/**
 * Create or edit a product.
 *
 * One page for both, because the fields are identical and a separate "new"
 * form is the same code with a different fetch.
 *
 * Two rules from the server that the UI has to respect rather than discover:
 *
 *   - A product cannot be published without an HSN code. The server returns
 *     422 HSN_REQUIRED; showing that as a red toast after a long form is a bad
 *     way to learn it, so the publish switch is disabled with the reason.
 *   - Slug is the identity. It is editable when creating and locked
 *     afterwards: changing it would break every link and every prerendered
 *     page that already points at it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { adminApi, AdminApiError, type AdminProduct, type AdminIdentity } from '../api/client';
import { PageHeader, Card, SectionTitle } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { Field, TextArea, Select, ListField } from '../components/ui/Field';
import { VariantsCard } from '../components/VariantsCard';
import { SkeletonCards, ErrorState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';

const CATEGORIES = [
  { value: 'classics', label: 'South Indian Classics' },
  { value: 'spices', label: 'Spice Powders' },
  { value: 'chutney_podi', label: 'Chutney & Podi' },
  { value: 'combos', label: 'Combo Collections' },
];

type Draft = Omit<AdminProduct, 'variants'>;

const EMPTY: Draft = {
  slug: '', name: '', regionalName: '', shortDescription: '',
  category: 'classics', categoryLabel: 'South Indian Classics', badge: '',
  about: '', ingredients: [''], howToUse: [''], storage: '',
  nutrition: { servingSize: '', energy: '', protein: '', carbohydrates: '', fat: '' },
  spiceLevel: '', image: '', gallery: [], featured: false, isSignature: false,
  published: false, hsnCode: '',
};

/** Lowercase, hyphenated, no trailing junk — matches the server's regex. */
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const AdminProductEditPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const isNew = !slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useOutletContext<AdminIdentity | undefined>();
  const { notify } = useToast();
  const isOwner = me?.role === 'owner';

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'product', slug],
    queryFn: () => adminApi.product(slug!),
    enabled: !isNew,
  });

  /**
   * Seed the form from the server ONCE per product, not on every refetch.
   *
   * Keyed on slug rather than on `data`: react-query refetches on window focus
   * and after invalidation, and re-seeding on each of those silently throws
   * away whatever is half-typed. It did exactly that here — a save looked like
   * it succeeded while the draft had already been reset underneath it.
   */
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    if (!data || seeded.current === data.slug) return;
    seeded.current = data.slug;
    const { variants: _v, ...rest } = data;
    setDraft({ ...rest, ingredients: rest.ingredients ?? [''], howToUse: rest.howToUse ?? [''] });
  }, [data]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      /**
       * An explicit whitelist, not a spread of the draft.
       *
       * The draft is seeded from the API response, which carries id,
       * createdAt, rating and reviewsCount. The server's schema is .strict(),
       * so spreading those in gets the whole save rejected for fields the
       * form never showed anyone.
       */
      const body: Record<string, unknown> = {
        slug: d.slug,
        name: d.name,
        regionalName: d.regionalName || null,
        shortDescription: d.shortDescription,
        category: d.category,
        categoryLabel: d.categoryLabel,
        badge: d.badge || null,
        about: d.about,
        ingredients: d.ingredients.filter((x) => x.trim()),
        howToUse: d.howToUse.filter((x) => x.trim()),
        storage: d.storage,
        nutrition: {
          servingSize: d.nutrition?.servingSize ?? '',
          energy: d.nutrition?.energy ?? '',
          protein: d.nutrition?.protein ?? '',
          carbohydrates: d.nutrition?.carbohydrates ?? '',
          fat: d.nutrition?.fat ?? '',
        },
        spiceLevel: d.spiceLevel,
        image: d.image,
        gallery: (d.gallery ?? []).filter((x) => x.trim()),
        featured: d.featured,
        isSignature: d.isSignature,
        published: d.published,
        hsnCode: d.hsnCode || null,
      };
      return isNew ? adminApi.createProduct(body) : adminApi.updateProduct(slug!, body);
    },
    onSuccess: (saved) => {
      // Only the list is invalidated. Refetching THIS product would race the
      // form it is feeding, and the response we just got is already current.
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      setErrors({});
      notify({ tone: 'success', title: isNew ? 'Product created' : 'Changes saved' });
      if (isNew) navigate(`/products/${(saved as AdminProduct).slug}/edit`, { replace: true });
    },
    onError: (e: unknown) => {
      // The server validates too, and its field errors are the authority.
      const err = e as AdminApiError;
      const details = err.details;
      if (details) {
        setErrors(Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v[0] ?? 'Invalid'])));
        notify({ tone: 'error', title: 'Some fields need attention — see the highlighted ones.' });
      } else {
        notify({ tone: 'error', title: err?.message ?? 'Could not save.' });
      }
    },
  });

  const unpublish = useMutation({
    mutationFn: () => adminApi.unpublishProduct(slug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      notify({ tone: 'success', title: 'Product removed from the storefront' });
      navigate('/products');
    },
    onError: (e: unknown) => notify({ tone: 'error', title: (e as AdminApiError)?.message ?? 'Could not remove.' }),
  });

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.uploadImage(file),
    onSuccess: (r) => { set('image', r.url); notify({ tone: 'success', title: 'Image uploaded' }); },
    onError: (e: unknown) => notify({ tone: 'error', title: (e as AdminApiError)?.message ?? 'Upload failed.' }),
  });

  if (!isNew && isLoading) return <SkeletonCards count={3} />;
  if (!isNew && isError) {
    return <ErrorState title="Could not load this product" onRetry={() => refetch()} />;
  }

  const blockedByHsn = draft.published && !draft.hsnCode?.trim();

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}
      className="space-y-6 pb-28 md:pb-6"
    >
      <PageHeader
        title={isNew ? 'New product' : draft.name || slug!}
        subtitle={isNew ? 'Add something to the catalogue' : 'Edit catalogue details'}
        actions={
          <Link to="/products" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#87380F] hover:underline">
            ← Back to products
          </Link>
        }
      />

      <Card>
        <SectionTitle>Basics</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Product name" name="name" required
            value={draft.name}
            error={errors.name}
            onChange={(e) => {
              set('name', e.target.value);
              if (isNew && !slugTouched) set('slug', slugify(e.target.value));
            }}
          />
          <Field
            label="Regional name" name="regionalName"
            value={draft.regionalName ?? ''}
            error={errors.regionalName}
            hint="Shown under the English name, e.g. ಸಾಂಪ್ರದಾಯಿಕ ರಸಂ ಪುಡಿ"
            onChange={(e) => set('regionalName', e.target.value)}
          />
          <Field
            label="URL slug" name="slug" required
            value={draft.slug}
            error={errors.slug}
            disabled={!isNew}
            hint={isNew
              ? 'Lowercase letters, numbers and hyphens'
              : 'Locked — changing it would break existing links and shared previews'}
            onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }}
          />
          <Select
            label="Category" name="category" required
            value={draft.category}
            error={errors.category}
            options={CATEGORIES}
            onChange={(e) => {
              const c = CATEGORIES.find((x) => x.value === e.target.value)!;
              set('category', c.value); set('categoryLabel', c.label);
            }}
          />
          <Field
            label="Badge" name="badge"
            value={draft.badge ?? ''}
            error={errors.badge}
            hint="Optional ribbon, e.g. Bestseller"
            onChange={(e) => set('badge', e.target.value)}
          />
          <Field
            label="Spice level" name="spiceLevel" required
            value={draft.spiceLevel}
            error={errors.spiceLevel}
            hint="e.g. Medium"
            onChange={(e) => set('spiceLevel', e.target.value)}
          />
        </div>

        <TextArea
          label="Short description" name="shortDescription" required
          className="mt-4"
          value={draft.shortDescription}
          error={errors.shortDescription}
          rows={2}
          hint="One or two lines. This is what appears on cards and in search results."
          onChange={(e) => set('shortDescription', e.target.value)}
        />
        <TextArea
          label="About" name="about" required
          className="mt-4"
          value={draft.about}
          error={errors.about}
          rows={5}
          onChange={(e) => set('about', e.target.value)}
        />
      </Card>

      <Card>
        <SectionTitle>Image</SectionTitle>
        <div className="flex flex-wrap items-start gap-4">
          {draft.image ? (
            <img
              src={draft.image}
              alt=""
              className="h-28 w-28 rounded-md border border-[#EBD9BC] object-cover"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center rounded-md border border-dashed border-[#EBD9BC] text-[11px] text-[#483828]/50">
              No image
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Field
              label="Image path" name="image" required
              value={draft.image}
              error={errors.image}
              hint="Upload below, or paste a path already in /images"
              onChange={(e) => set('image', e.target.value)}
            />
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[#EBD9BC] bg-white px-4 text-xs font-semibold text-[#483828] transition-colors hover:border-[#87380F] hover:text-[#87380F]">
              {upload.isPending ? 'Uploading…' : 'Upload an image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }}
              />
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <VariantsCard slug={slug} variants={data?.variants ?? []} isOwner={isOwner} />
      </Card>

      <Card>
        <SectionTitle>Details</SectionTitle>
        <div className="space-y-5">
          <ListField
            label="Ingredients" name="ingredients"
            values={draft.ingredients}
            error={errors.ingredients}
            placeholder="Byadagi chilli"
            onChange={(v) => set('ingredients', v)}
          />
          <ListField
            label="How to use" name="howToUse"
            values={draft.howToUse}
            error={errors.howToUse}
            placeholder="Add two teaspoons to simmering rasam"
            onChange={(v) => set('howToUse', v)}
          />
          <TextArea
            label="Storage" name="storage" required
            value={draft.storage}
            error={errors.storage}
            rows={2}
            onChange={(e) => set('storage', e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>Nutrition</SectionTitle>
        <p className="mb-3 text-[11px] text-[#483828]/60">
          Per the declared serving. Legal Metrology requires these on the pack — see docs/COMPLIANCE.md.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['servingSize', 'Serving size'], ['energy', 'Energy'], ['protein', 'Protein'],
            ['carbohydrates', 'Carbohydrates'], ['fat', 'Fat'],
          ] as const).map(([key, label]) => (
            <Field
              key={key} label={label} name={`nutrition.${key}`}
              value={draft.nutrition?.[key] ?? ''}
              onChange={(e) => set('nutrition', { ...draft.nutrition, [key]: e.target.value })}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Tax and visibility</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="HSN code" name="hsnCode"
            value={draft.hsnCode ?? ''}
            error={errors.hsnCode}
            hint="Required before publishing. Confirm this with your CA — every product is seeded at 0910, which is a guess."
            onChange={(e) => set('hsnCode', e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-3">
          {([
            ['published', 'Visible on the storefront'],
            ['featured', 'Featured on the homepage'],
            ['isSignature', 'Signature product'],
          ] as const).map(([key, label]) => {
            const blocked = key === 'published' && !draft.hsnCode?.trim();
            return (
              <label
                key={key}
                className={cn(
                  'flex min-h-11 items-center gap-3 text-sm',
                  blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(draft[key])}
                  disabled={blocked}
                  onChange={(e) => set(key, e.target.checked)}
                  className="h-5 w-5 accent-[#87380F]"
                />
                <span>
                  {label}
                  {blocked && (
                    <span className="ml-2 text-[11px] text-[#483828]/60">
                      — add an HSN code first
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Sticky on mobile so Save is in the thumb zone after a long form. */}
      <div className="fixed inset-x-0 bottom-14 z-30 flex gap-3 border-t border-[#EBD9BC] bg-[#FAF6F0] px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
        <Button type="submit" disabled={save.isPending || blockedByHsn} className="flex-1 md:flex-none">
          {save.isPending ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
        </Button>

        {!isNew && draft.published && (
          isOwner ? (
            <Button
              type="button"
              variant="danger"
              disabled={unpublish.isPending}
              onClick={() => {
                if (confirm(`Remove "${draft.name}" from the storefront?\n\nIt stays in the database with its order history and can be published again.`)) {
                  unpublish.mutate();
                }
              }}
            >
              Remove from store
            </Button>
          ) : (
            <Button type="button" variant="danger" disabled title="Only owners can remove a product.">
              Remove from store
            </Button>
          )
        )}
      </div>
    </form>
  );
};
