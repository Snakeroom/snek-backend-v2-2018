import Hapi from "hapi";
import Boom from "boom";
import Joi from "joi";
import r, { conn } from "../db";
import { guessKey } from "../auth/reddit";

const ID_REGEX = /\/([a-z0-9]{6})(\/|$)/;

const routes: Hapi.ServerRoute[] = [
	{
		method: "GET",
		path: "/",
		async handler(req, h) {
			let hasRequested = false;
			// If user isn't an admin, check if they've requested
			if (req.auth.credentials && !(req.auth.credentials as any).scope.includes("admin")) {
				hasRequested = !!await r
					.table("requests")
					.get((req.auth.credentials as any).user.name)
					.run(conn);
			}

			return h.view("index.html", {
				assimilations: 5,
				authenticated: req.auth.isAuthenticated,
				hasRequested
			});
		},
		options: {
			auth: {
				mode: "try",
				strategy: "reddit"
			}
		}
	},

	{
		method: "GET",
		path: "/{param*}",
		handler: {
			directory: {
				path: "static"
			}
		}
	},

	{
		method: "POST",
		path: "/request-circle",
		async handler(req, h) {
			const { url, key } = req.payload as any;
			const id = "t3_" + url.match(ID_REGEX)[1];

			if (!await guessKey((req.auth.credentials as any).user.accessToken, id, key)) throw Boom.badData("invalid key/url");

			return await r
				.table("requests")
				.insert(
					{
						name: (req.auth.credentials as any).user.name,
						id,
						key
					},
					{
						conflict: (req.auth.credentials as any).scope.includes("admin")
							? "replace"
							: "error"
					}
				)
				.run(conn)
				.then(res => {
					if (res.errors > 0) throw Boom.conflict("already requested");
					else return h.redirect("/");
				});
		},
		options: {
			auth: {
				mode: "required",
				strategy: "reddit"
			},
			validate: {
				payload: {
					url: Joi.string()
						.trim()
						.regex(ID_REGEX)
						.required(),
					key: Joi.string()
						.min(1)
						.required()
				}
			}
		}
	}
];

export default () => routes;
