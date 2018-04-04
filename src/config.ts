const ident = process.env.NODE_ENV != "production" ? "dev" : "prod";
const config = require("../config." + ident + ".json");

interface Config {
	database: {
		host: string;
		port: number;
		db: string;
	};
	reddit: {
		clientId: string;
		clientSecret: string;
		redirectUri: string;
	};
	redis: {
		host: string;
		port: string;
		database: string;
	};
	secret: string;
	worker_secret: string;
	server: {
		host: string;
		port?: number;
	};
}

export default config as Config;
