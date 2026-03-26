import { Test } from "./test"
import { Tost } from "./tost";

export const MODELS = [
  Test,
  Tost
];

export type Model = typeof MODELS[number];