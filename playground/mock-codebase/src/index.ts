export type { PostalAddress } from "./domain/addresses.js";
export type { JsonValue, ProductId, UserId } from "./domain/primitives.js";
export type { UserProfile } from "./domain/users.js";
export type { ProductRecord, ProductVariant } from "./catalog/products.js";
export type { InventoryRecord } from "./catalog/inventory.js";
export type { CartItem, CartSnapshot } from "./orders/cart.js";
export type {
  CheckoutHandler,
  CheckoutInput,
  CheckoutResult
} from "./orders/checkout.js";
export type { StoreCommand } from "./app/commands.js";
export type { StoreState } from "./app/state.js";

