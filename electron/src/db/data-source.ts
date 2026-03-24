import { DataSource } from "typeorm";
import { DbConfigService } from "../services/db-config.service";
import { Test } from "./entities/test";
import { Injector } from "../helpers/mini-pie/injector";
import { ConfigService } from "../services/config.service";

const dbConfigService = Injector.inject(DbConfigService);

export const AppDataSource = new DataSource({
	type: "sqlite",
	database: dbConfigService.dbPath,
	synchronize: true, // Sincronizza lo schema del database con le entità
	logging: true, // Abilita temporaneamente i log SQL per debug
	entities: [
		Test,
	],
	migrations: [],
	subscribers: [],
});
