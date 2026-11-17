// Copied from mobile/src/hooks/useCustomer.ts (shared business logic, keep the two in step).
/**
 * Signed-in customer data: addresses, orders and quotes. Every key starts
 * with 'customer', so all of it is dropped when the customer signs out.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import * as customerApi from '@/api/customer';
import * as ordersApi from '@/api/orders';
import type { Address, AddressInput, OrderDetail, OrderLine, OrderSummary, Paginated } from '@/api/types';
import { queryKeys } from '@/lib/queryClient';

export function useAddresses({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.addresses, queryFn: ({ signal }) => customerApi.listAddresses(signal), enabled });
}

/** Create, update, delete and make-default, each refreshing the address list from the server afterwards. */
export function useAddressMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses });

  const create = useMutation({ mutationFn: (input: AddressInput) => customerApi.createAddress(input), onSettled: refresh });
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<AddressInput> }) => customerApi.updateAddress(id, changes),
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: (id: number) => customerApi.deleteAddress(id), onSettled: refresh });
  const makeDefault = useMutation({
    mutationFn: (id: number) => customerApi.updateAddress(id, { isDefault: true }),
    // Show the change at once; the refetch afterwards confirms it.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.addresses });
      const previous = queryClient.getQueryData<Address[]>(queryKeys.addresses);
      if (previous) queryClient.setQueryData(queryKeys.addresses, previous.map((a) => ({ ...a, isDefault: a.id === id })));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.addresses, context.previous);
    },
    onSettled: refresh,
  });
  return { create, update, remove, makeDefault };
}

function nextOrdersPage(lastPage: Paginated<OrderSummary>, pages: Paginated<OrderSummary>[]) {
  return lastPage.next ? pages.length + 1 : undefined;
}

function flattenOrders(data: InfiniteData<Paginated<OrderSummary>, number>) {
  const seen = new Set<number>();
  const orders = data.pages.flatMap((p) => p.results).filter((o) => !seen.has(o.id) && !!seen.add(o.id));
  return { orders, count: data.pages[0]?.count ?? 0 };
}

/** GET /customer/orders/ a page (10) at a time, newest first. */
export function useOrderPages({ enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.orderPages,
    queryFn: ({ pageParam, signal }) => ordersApi.listOrders(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: nextOrdersPage,
    select: flattenOrders,
    enabled,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(id ?? ''),
    queryFn: ({ signal }) => ordersApi.getOrder(id!, signal),
    enabled: !!id && /^\d+$/.test(id),
  });
}

/** Stores a fresh order (placed or cancelled) and refreshes the history list. */
export function useRememberOrder() {
  const queryClient = useQueryClient();
  return (order: OrderDetail) => {
    queryClient.setQueryData(queryKeys.order(order.id), order);
    void queryClient.invalidateQueries({ queryKey: queryKeys.orderPages });
  };
}

export function useCancelOrder(id: number) {
  const remember = useRememberOrder();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => ordersApi.cancelOrder(id, reason),
    onSuccess: remember,
    // A failure usually means the store moved the order on: show its current state.
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.order(id) }),
  });
}

/**
 * Server prices, delivery fee and total for the cart. Never served from cache:
 * a quote is only trusted until the next one. Problems (out of stock, "only N
 * left") come back as ApiError.items.
 */
export function useOrderQuote(lines: OrderLine[], { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.quote(lines),
    queryFn: ({ signal }) => ordersApi.quoteOrder(lines, signal),
    enabled: enabled && lines.length > 0,
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
}
