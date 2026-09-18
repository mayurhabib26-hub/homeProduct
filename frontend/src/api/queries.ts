/** TanStack Query hooks. Cache policy lives here, once. */
import { useQuery } from '@tanstack/react-query';
import { api, type ProductListParams } from './client';

/**
 * The catalogue changes rarely and the CDN already serves it stale — a minute
 * of client-side freshness costs nothing and avoids a refetch on every
 * navigation.
 */
const CATALOGUE_STALE_MS = 60_000;

export const useProducts = (params: ProductListParams = {}) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: () => api.products.list(params),
    staleTime: CATALOGUE_STALE_MS,
  });

export const useProduct = (slug: string | undefined) =>
  useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.products.get(slug!),
    enabled: Boolean(slug),
    staleTime: CATALOGUE_STALE_MS,
    retry: (count, err) =>
      // A missing product is an answer, not a failure — do not retry it.
      (err as { code?: string }).code === 'NOT_FOUND' ? false : count < 2,
  });

export const useRecipes = () =>
  useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.recipes.list(),
    staleTime: CATALOGUE_STALE_MS,
  });
