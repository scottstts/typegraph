import type { UserProfile } from "../domain/users.js";
import type { ISODateString, OrderId } from "../domain/primitives.js";
import type { CartSnapshot } from "./cart.js";

export interface RequestContext {
  requestId: string;
  signal?: AbortSignal;
  referrer?: URL;
}

export type CheckoutInput = CartSnapshot & {
  customer: UserProfile;
  context: RequestContext;
};

export type CheckoutSuccess = {
  ok: true;
  orderId: OrderId;
  placedAt: ISODateString;
};

export type CheckoutFailure = {
  ok: false;
  reason: "payment_failed" | "out_of_stock" | "invalid_cart";
};

export type CheckoutResult = CheckoutSuccess | CheckoutFailure;

export type CheckoutHandler = (input: CheckoutInput) => Promise<CheckoutResult>;

