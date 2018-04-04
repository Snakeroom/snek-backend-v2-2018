import Hapi from "hapi";
import * as Joi from "joi";
import Boom from "boom";
import { v4 } from "uuid";
import * as reddit from "../auth/reddit";
import r, { conn } from "../db";

const routes: Hapi.ServerRoute[] = [
	{
		method: "GET",
		path: "/session",
		async handler(req) {
			return {
				...(req.yar as any)["_store"],
				error: req.yar.get("error", true),
				user: (req.auth.credentials as any || {}).user
			};
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
		path: "/auth/logout",
		async handler(req, h) {
			req.yar.reset();
			await r
				.table("users")
				.get((req.auth.credentials as any).user.name)
				.delete()
				.run(conn);

			return h.redirect("/");
		},
		options: {
			auth: {
				mode: "required",
				strategy: "reddit"
			}
		}
	},

	{
		method: "GET",
		path: "/auth/reddit",
		handler(req, h) {
			const state = v4();
			req.yar.set("state", state);
			req.yar.set("origin", req.headers["referer"]);

			return h.redirect(reddit.getAuthorizeUrl(state));
		}
	},

	{
		method: "GET",
		path: "/auth/reddit/callback",
		async handler(req, h) {
			const state = req.yar.get("state", true) as string;
			const query = req.query as Hapi.RequestQuery;
			if (query.error)
				throw Boom.unauthorized("Could not login with Reddit.");

			if (query.state != state) {
				throw Boom.badData("Invalid `state` query parameter.");
			}

			try {
				const token = await reddit.getToken(query.code as string);
				const user = await reddit.getOrCreateUser(token);

				req.yar.set("name", user.name);
				return h.redirect(
					(req.yar.get("origin", true) as string) || "/"
				);
			} catch (e) {
				throw Boom.badImplementation(e);
			}
		},
		options: {
			validate: {
				query: {
					error: Joi.string().optional(),
					code: Joi.string().optional(),
					scope: Joi.string().optional(),
					state: Joi.string()
						.uuid()
						.required()
				}
			}
		}
	}
];

export default () => routes;
