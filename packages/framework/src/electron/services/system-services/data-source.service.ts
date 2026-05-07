import { DataSource, EntitySubscriberInterface, EntityTarget, EventSubscriber, ObjectLiteral, RemoveEvent } from "typeorm";
import { Injectable } from "../../helpers/mini-pie/decorators";
import { Injector } from "../../helpers/mini-pie/injector";
import { Logger } from "../../helpers/logger";
import { getOwnsAttachmentsType } from "../../decorators/owns-attachments.decorator";
import { DbConfigService } from "./db-config.service";
import { Constructor } from "../../helpers/mini-pie/types";

/**
 * Global TypeORM subscriber that, on `afterRemove` of any entity decorated
 * with `@OwnsAttachments(ownerType)`, calls
 * `UploadService.deleteByOwner(ownerType, entity.id)` to clean up the
 * associated attachments. UploadService is resolved lazily through the
 * mini-pie injector to avoid a circular dependency at module load.
 */
@EventSubscriber()
export class AttachmentCleanupSubscriber implements EntitySubscriberInterface {
	async afterRemove(event: RemoveEvent<ObjectLiteral>): Promise<void> {
		const entity = event.entity;
		if (!entity) return;
		const ownerType = getOwnsAttachmentsType(entity.constructor);
		if (!ownerType) return;
		const id = (entity as { id?: unknown }).id;
		if (typeof id !== "number") return;
		const upload = Injector.getLoadedInjectable("UploadService") as
			| { deleteByOwner: (t: string, i: number) => Promise<number> }
			| undefined;
		if (!upload) {
			Logger.warn(`[AttachmentCleanup] UploadService not loaded; skipping cleanup for ${ownerType}/${id}.`);
			return;
		}
		try {
			const count = await upload.deleteByOwner(ownerType, id);
			if (count > 0) {
				Logger.info(`[AttachmentCleanup] Deleted ${count} attachment(s) for ${ownerType}/${id}.`);
			}
		} catch (err) {
			Logger.warn(`[AttachmentCleanup] Failed to delete attachments for ${ownerType}/${id}:`, err);
		}
	}
}

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
			synchronize: false,
			logging: false,
			entities: this.entityList,
			migrations: [],
			subscribers: [AttachmentCleanupSubscriber],
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
