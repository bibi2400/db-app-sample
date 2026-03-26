import { DataSource } from "typeorm";
import { DbConfigService } from "../services/system-services/db-config.service";
import { MODELS, Model } from './entities';
import { Injector } from "../helpers/mini-pie/injector";

export class AppDataSource {
	private static klassInstance: AppDataSource | null = null;
	private ds: DataSource;
	private readonly dbConfigService = Injector.inject(DbConfigService);

	private constructor() {
		this.ds = new DataSource({
			type: "sqlite",
			database: this.dbConfigService.dbPath,
			synchronize: true,
			logging: true,
			entities: MODELS,
			migrations: [],
			subscribers: [],
		});
	}

	static async initialize(): Promise<AppDataSource> {
		if (this.klassInstance?.isInitialized) return this.klassInstance;

		this.klassInstance = new AppDataSource();
		await this.klassInstance.ds.initialize();

		return this.klassInstance;
	}

	static get instance(): AppDataSource {
		if (!this.klassInstance?.isInitialized) {
			throw new Error("AppDataSource not initialized. Call AppDataSource.initialize() first.");
		}
		return this.klassInstance;
	}

	get dataSource(): DataSource {
		return this.ds;
	}

	get isInitialized(): boolean {
		return this.ds.isInitialized;
	}

	model(model: Model) {
		return this.dataSource.manager.getRepository(model);
	}

	async destroy(): Promise<void> {
		if (this.ds.isInitialized) {
			await this.ds.destroy();
		}
	}
}
