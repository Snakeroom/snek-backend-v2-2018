import Hapi from "hapi";
import Inert from "inert";
import Vision from "vision";
import Nunjucks from "nunjucks";
import yar from "yar";
import catboxRedis from "catbox-redis";
import config from "./config";
import { init } from "./db";
import routes from "./routes";
import errorHandler from "./errorHandler";
import scheme from "./auth/scheme";

const server = new Hapi.Server({
	cache: {
		engine: catboxRedis,
		host: config.redis.host,
		port: config.redis.port,
		database: config.redis.database
	},
	debug: process.env.NODE_ENV != "production" ? undefined : false,
	host: config.server.host,
	port: config.server.port || process.env.PORT,
	router: {
		stripTrailingSlash: true,
		isCaseSensitive: false
	},
	routes: {
		response: {
			emptyStatusCode: 204
		}
	}
});

server.auth.scheme("reddit", scheme);
server.auth.strategy("reddit", "reddit");

const start = async () => {
	await server.register([
		{
			plugin: yar,
			options: {
				storeBlank: false,
				cookieOptions: {
					password: config.secret,
					isSecure: process.env.NODE_ENV == "production"
				}
			}
		}
	]);
	await server.register(Inert);
	await server.register(Vision);

	server.views({
		engines: {
			html: {
				compile: (src: string, options: any) => {
					const template = Nunjucks.compile(src, options.environment);

					return (context: any) => {
						return template.render(context);
					};
				},

				prepare: (options: any, next) => {
					options.compileOptions.environment = Nunjucks.configure(
						options.path,
						{ watch: false }
					);

					return next();
				}
			}
		},
		relativeTo: __dirname,
		path: "../views"
	});

	server.events.on("log", (e, tags: any) => {
		if (tags.error) {
			console.error(`Server error: ${e.error ? (e.error as any).message : "unknown"}`);
		}
	});

	server.route(routes());
	// TODO: server.ext("onPreResponse", errorHandler);

	await init();
	console.log("Connected to database.");

	await server.start();
	console.log("Started at: " + server.info.uri);
};

start();
