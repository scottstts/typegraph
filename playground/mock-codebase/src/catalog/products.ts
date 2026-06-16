import type {
  JsonValue,
  MoneyCents,
  ProductId
} from "../domain/primitives.js";

export enum ProductStatus {
  Draft = "draft",
  Active = "active",
  Archived = "archived"
}

export type ProductVariant = {
  sku: string;
  label: string;
  price: MoneyCents;
  metadata?: JsonValue;
};

export type ProductRecord = {
  id: ProductId;
  title: string;
  status: ProductStatus;
  variants: readonly ProductVariant[];
  tags?: readonly string[];
};

