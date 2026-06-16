import type { ProductId } from "../domain/primitives.js";

export type InventoryLocation = "warehouse" | "storefront" | "supplier";

export interface InventoryRecord {
  productId: ProductId;
  available: number;
  reserved: number;
  location: InventoryLocation;
}

