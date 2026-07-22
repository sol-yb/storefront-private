"use server";

import type { AddressParams, Cart } from "@spree/sdk";
import { SpreeError } from "@spree/sdk";
import { updateTag } from "next/cache";
import {
  cacheTagSuffix,
  getCartId,
  getCartOptions,
  getClientForSurface,
  requireCartId,
  type Surface,
} from "@/lib/spree";
import { getCart } from "./cart";
import { getOrder } from "./orders";
import { actionResult, withFallback } from "./utils";

/**
 * Determine which surface a checkout belongs to by matching its cart id against
 * the per-surface cart-id cookies. This is what lets one checkout flow serve
 * both surfaces: the `[id]` in the URL identifies the cart, and the cart id
 * cookie it matches identifies the channel (and thus which client + token to
 * use). Defaults to DTC when it matches neither (e.g. a completed order fetched
 * by number after cookies were cleared).
 */
export async function resolveSurfaceForCart(cartId: string): Promise<Surface> {
  const wholesaleCartId = await getCartId("wholesale");
  return wholesaleCartId === cartId ? "wholesale" : "dtc";
}

/** Checkout cache tag, segmented per surface. */
function checkoutTag(surface: Surface): string {
  return `checkout${cacheTagSuffix(surface)}`;
}

function cartTag(surface: Surface): string {
  return `cart${cacheTagSuffix(surface)}`;
}

export async function getCheckoutOrder(cartId: string): Promise<Cart | null> {
  const surface = await resolveSurfaceForCart(cartId);

  // Try active cart first (order may still be in checkout)
  const cart = await getCart(undefined, surface);
  if (cart && cart.id === cartId) return cart;

  // Cart completed — fetch as completed order.
  return withFallback(
    async () => (await getOrder(cartId, undefined, surface)) as unknown as Cart,
    null,
  );
}

export async function getCompletedOrder(cartId: string): Promise<Cart | null> {
  const surface = await resolveSurfaceForCart(cartId);

  // Fetch order directly — used by the order-placed page.
  // Does not call getCart() first because getCart() auto-clears
  // the cart token cookie on failure, which breaks getOrder()
  // for guest users.
  return withFallback(
    async () => (await getOrder(cartId, undefined, surface)) as unknown as Cart,
    null,
  );
}

export async function updateOrderAddresses(
  cartId: string,
  addresses: {
    shipping_address?: AddressParams;
    billing_address?: AddressParams;
    shipping_address_id?: string;
    billing_address_id?: string;
    use_shipping?: boolean;
    email?: string;
  },
) {
  return actionResult(async () => {
    const surface = await resolveSurfaceForCart(cartId);
    const options = await getCartOptions(surface);
    const id = await requireCartId(surface);
    const cart = await getClientForSurface(surface).carts.update(
      id,
      addresses,
      options,
    );
    updateTag(checkoutTag(surface));
    return { cart };
  }, "Failed to update addresses");
}

export async function updateCartMarket(
  cartId: string,
  params: { currency: string; locale: string },
) {
  return actionResult(async () => {
    const surface = await resolveSurfaceForCart(cartId);
    const options = await getCartOptions(surface);
    const id = await requireCartId(surface);
    const cart = await getClientForSurface(surface).carts.update(
      id,
      params,
      options,
    );
    updateTag(checkoutTag(surface));
    return { cart };
  }, "Failed to update order market");
}

export async function selectDeliveryRate(
  cartId: string,
  fulfillmentId: string,
  deliveryRateId: string,
) {
  return actionResult(async () => {
    const surface = await resolveSurfaceForCart(cartId);
    const options = await getCartOptions(surface);
    const id = await requireCartId(surface);
    const cart = await getClientForSurface(surface).carts.fulfillments.update(
      id,
      fulfillmentId,
      { selected_delivery_rate_id: deliveryRateId },
      options,
    );
    updateTag(checkoutTag(surface));
    return { cart };
  }, "Failed to select delivery rate");
}

/**
 * Apply a code to the cart — tries discount code first, then gift card.
 * Single input field on checkout, backend determines the type.
 */
export async function applyCode(cartId: string, code: string) {
  const surface = await resolveSurfaceForCart(cartId);
  const options = await getCartOptions(surface);
  const id = await requireCartId(surface);
  const client = getClientForSurface(surface);

  // Try discount code first (more common)
  try {
    const cart = await client.carts.discountCodes.apply(id, code, options);
    updateTag(checkoutTag(surface));
    updateTag(cartTag(surface));
    return { success: true, cart, type: "discount" as const };
  } catch (discountError) {
    // Only fall back to gift card if the discount code was not found (422/404).
    // Network errors, 500s, etc. should surface the backend message directly.
    const isNotFound =
      discountError instanceof SpreeError &&
      (discountError.status === 422 || discountError.status === 404);

    if (!isNotFound) {
      return { success: false, error: errorMessage(discountError) } as const;
    }

    // Discount code not found — try gift card
    try {
      const cart = await client.carts.giftCards.apply(id, code, options);
      updateTag(checkoutTag(surface));
      updateTag(cartTag(surface));
      return { success: true, cart, type: "gift_card" as const };
    } catch (giftCardError) {
      // Gift card also failed. If it's a specific error (expired, redeemed, etc.)
      // show the backend message. If both are just "not found", show the
      // discount error (the more common scenario).
      const isGiftCardNotFound =
        giftCardError instanceof SpreeError &&
        (giftCardError.code === "gift_card_not_found" ||
          giftCardError.code === "record_not_found");

      return {
        success: false,
        error: isGiftCardNotFound
          ? errorMessage(discountError)
          : errorMessage(giftCardError),
      } as const;
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "The entered code is not valid";
}

export async function removeDiscountCode(cartId: string, code: string) {
  return actionResult(async () => {
    const surface = await resolveSurfaceForCart(cartId);
    const options = await getCartOptions(surface);
    const id = await requireCartId(surface);
    const cart = await getClientForSurface(surface).carts.discountCodes.remove(
      id,
      code,
      options,
    );
    updateTag(checkoutTag(surface));
    updateTag(cartTag(surface));
    return { cart };
  }, "Failed to remove discount code");
}

export async function removeGiftCard(cartId: string, giftCardId: string) {
  return actionResult(async () => {
    const surface = await resolveSurfaceForCart(cartId);
    const options = await getCartOptions(surface);
    const id = await requireCartId(surface);
    const cart = await getClientForSurface(surface).carts.giftCards.remove(
      id,
      giftCardId,
      options,
    );
    updateTag(checkoutTag(surface));
    updateTag(cartTag(surface));
    return { cart };
  }, "Failed to remove gift card");
}
