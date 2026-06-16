import type { ProductRecord } from "../catalog/products.js";
import type {
  CartId,
  ISODateString,
  MoneyCents,
  ProductId
} from "../domain/primitives.js";

export type CartItem = {
  productId: ProductId;
  product: ProductRecord;
  quantity: number;
  unitPrice: MoneyCents;
};

export type CartSnapshot = {
  id: CartId;
  items: readonly CartItem[];
  updatedAt: ISODateString;
};

