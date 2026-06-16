import type { PostalAddress } from "./addresses.js";
import type { ISODateString, UserId } from "./primitives.js";

export type UserProfile = {
  id: UserId;
  name: string;
  email?: string;
  defaultAddress?: PostalAddress;
  createdAt: ISODateString;
};

