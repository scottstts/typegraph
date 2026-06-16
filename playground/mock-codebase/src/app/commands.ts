import type { ProductId } from "../domain/primitives.js";
import type { CheckoutInput } from "../orders/checkout.js";

export type StoreCommand =
  | { type: "addItem"; productId: ProductId; quantity: number }
  | { type: "removeItem"; productId: ProductId }
  | { type: "checkout"; input: CheckoutInput };

