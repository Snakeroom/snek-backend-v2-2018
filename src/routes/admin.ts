import Hapi from "hapi";
import * as Joi from "joi";
import Boom from "boom";
import chunk from "lodash.chunk";
import r, { conn } from "../db";
import * as reddit from "../auth/reddit";

const joinCircle = async (id: string, key: string) => {
	const voteChunk = () => {
		for (let token of chunks[curChunk]) {
			reddit.checkToken(token).then(newToken => {
				token = newToken;
				reddit.guessKey(token, id, key).then(() => {
					reddit.circleVote(token, id, 1);
				});
			});
		}

		curChunk++;

		if (curChunk < chunks.length) {
			setTimeout(voteChunk, 60 * 1000);
		}
	};

	const tokens = await r
		.table("users")
		.withFields("accessToken")
		.run(conn)
		.then(c => c.toArray());

	const chunks = chunk(tokens.map(info => info.accessToken), 60);
	let curChunk = 0;
	voteChunk();
};

const addAdmin = (name: string) => {
	return r
		.table("users")
		.filter({ name: name })
		.nth(0)
		.update({
			scope: r.row("scope").append("admin")
		})
		.run(conn)
		.then(res => {
			if (res.replaced <= 0) throw "Invalid name";
		});
};

const routes: Hapi.ServerRoute[] = [
	{
		method: "GET",
		path: "/admin",
		async handler(_, h) {
			const amtUsers = await r
				.table("users")
				.count()
				.run(conn);
			return h.view("admin", { amtUsers });
		},
		options: {
			auth: {
				mode: "required",
				strategy: "reddit",
				scope: "admin"
			}
		}
	},
	{
		method: "GET",
		path: "/admin/requests",
		async handler(_, h) {
			const requests = await r
				.table("requests")
				.run(conn)
				.then(c => c.toArray());
			return h.view("requests", { requests });
		},
		options: {
			auth: {
				mode: "required",
				strategy: "reddit",
				scope: "admin"
			}
		}
	},
	{
		method: "POST",
		path: "/admin/requests",
		async handler(req, h) {
			const {action, name} = req.payload as any;
			if (action === "approve") {
				const request = await r
					.table("requests")
					.filter({ name })
					.nth(0)
					.run(conn);

				joinCircle(request.id, request.key);
			}

			await r
				.table("requests")
				.filter({ name })
				.delete()
				.run(conn);

			return h.redirect("/admin/requests");
		},
		options: {
			auth: {
				mode: "required",
				strategy: "reddit",
				scope: "admin"
			},
			validate: {
				payload: {
					action: Joi.string().only("approve", "deny").required(),
					name: Joi.string().required()
				}
			}
		}
	},
	{
		method: "POST",
		path: "/admin/add",
		async handler(req, h) {
			try {
				await addAdmin((req.payload as any).name);
				return h.redirect("/");
			} catch (e) {
				throw Boom.badData("Invalid name");
			}
		},
		options: {
			auth: {
				mode: "required",
				strategy: "reddit",
				scope: "admin"
			},
			validate: {
				payload: {
					name: Joi.string().required()
				}
			}
		}
	}
];

export default () => routes;
