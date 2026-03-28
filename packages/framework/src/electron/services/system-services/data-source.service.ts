import { DataSource, EntityTarget, ObjectLiteral } from "typeorm";
import { Injectable } from "../../helpers/mini-pie/decorators";
import { DbConfigService } from "./db-config.service";
import { Constructor } from "../../helpers/mini-pie/types";

@Injectable()
export class DataSourceService {
	private ds!: DataSource;
	private entityList: Constructor[] = [];

	constructor(private readonly dbConfigService: DbConfigService) {}

	/**
	 * Set the entities to be registered with TypeORM.
	 * Must be called before initialize().
	 */
	setEntities(entities: Constructor[]): void {
		this.entityList = entities;
	}

	async initialize(): Promise<void> {
		this.ds = new DataSource({
			type: "sqlite",
			database: this.dbConfigService.dbPath,
			synchronize: true,
			logging: true,
			entities: this.entityList,
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

	model<T extends ObjectLiteral>(model: EntityTarget<T>) {
		return this.dataSource.manager.getRepository(model);
	}

	async destroy(): Promise<void> {
		if (this.ds?.isInitialized) {
			await this.ds.destroy();
		}
	}
}
