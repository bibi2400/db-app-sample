import { Injectable } from "../../helpers/mini-pie/decorators";
import { DataSourceService } from "./data-source.service";

@Injectable()
export class TestService {
  constructor(private readonly dataSourceService: DataSourceService) {}
}
