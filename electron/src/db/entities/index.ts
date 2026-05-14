import { MightyTableRow } from "./mighty-table";
import { Product } from "./product";
import { Test } from "./test"
import { Tost } from "./tost";

export const MODELS = [
  Product,
  Test,
  Tost,
  MightyTableRow,
];

export type Model = typeof MODELS[number];