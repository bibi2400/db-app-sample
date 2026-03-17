import fs from "fs";
import path from "path";
import { app } from "electron";
import { Injectable } from "../helpers/mini-pie/decorators";

@Injectable()
export class DbConfigService {

  private configDbPath = path.join(app.getAppPath(), "db-config.json");
  private defaultDbPath = "./database.sqlite";

  constructor() {

  }

  public readDbConfigFile() {
    if (!fs.existsSync(this.configDbPath)) {
      const defaultConfig = JSON.stringify({
        dbPath: this.defaultDbPath
      }, null, 2);

      fs.writeFileSync(this.configDbPath, defaultConfig);

      return this.defaultDbPath;
    } else {
      const configBuffer = fs.readFileSync(this.configDbPath);
      const config: ConfigDB = JSON.parse(configBuffer.toString());
      return config.dbPath;
    }
  }
}

type ConfigDB = {
	dbPath: string;
};