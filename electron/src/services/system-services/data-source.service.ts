import { DataSource } from "typeorm";
import { MODELS, Model } from '../../db/entities';
import { Injectable } from "../../helpers/mini-pie/decorators";
import { DbConfigService } from "./db-config.service";

@Injectable()
export class DataSourceService {
	private ds!: DataSource;

	constructor(private readonly dbConfigService: DbConfigService) {}

	async initialize(): Promise<void> {
		this.ds = new DataSource({
			type: "sqlite",
			database: this.dbConfigService.dbPath,
			synchronize: true,
			logging: true,
			entities: MODELS,
			migrations: [],
			subscribers: [],
		});
		await this.ds.initialize();
	}

	get dataSource(): DataSource {
		return this.ds;
	}

	get isInitialized(): boolean {
		return this.ds?.isInitialized ?? false;
	}

	model(model: Model) {
		return this.dataSource.manager.getRepository(model);
	}

	async destroy(): Promise<void> {
		if (this.ds?.isInitialized) {
			await this.ds.destroy();
		}
	}
}
