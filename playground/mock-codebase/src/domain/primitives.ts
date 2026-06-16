export type UserId = string;
export type ProductId = string;
export type CartId = string;
export type OrderId = string;
export type ISODateString = string;
export type MoneyCents = number;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

