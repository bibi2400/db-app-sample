// Consumer-specific Electron services
// Import and add custom services here.
import { TableDemoService } from "./table-demo.service";
import { ProductService } from "./product.service";

export const APP_SERVICES = [
  TableDemoService,
  ProductService,
];
