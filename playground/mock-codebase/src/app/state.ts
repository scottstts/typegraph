import type { ProductRecord } from "../catalog/products.js";
import type { UserProfile } from "../domain/users.js";
import type { CartSnapshot } from "../orders/cart.js";
import type { CheckoutResult } from "../orders/checkout.js";

export type StoreState = {
  currentUser?: UserProfile;
  catalog: readonly ProductRecord[];
  cart?: CartSnapshot;
  lastCheckout?: CheckoutResult;
};

