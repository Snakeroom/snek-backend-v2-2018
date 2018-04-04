import Hapi from "hapi";
import * as Joi from "joi";
import Boom from "boom";
import r, { conn, redis_client } from "../db";
import * as reddit from "../auth/reddit";
import config from "../config";

const NO_WORK = {"error": "no_work"};

const getWork = async (temp_q: boolean) => {
	let queue_name;

	let work = await redis_client.spopAsync("snakeworker:queue");
	if (!work) {
		// Nasty, but grab from the fail queue if the main queue has no work.
		work = await redis_client.spopAsync("snakeworker:grabbed");
		if (!work) {
			return NO_WORK;
		}
	}

	work = JSON.parse(work);
	let grab_time = (new Date()).getTime();
	
	// If there is a grabbed parameter, check if it is old enough to resend.
	if ((grab_time - work.grabbed) < 30) {
		return NO_WORK;
	}

	// Add it to the other queue and tag it if it doesn't have it.
	work.grabbed = (new Date()).getTime();
	await redis_client.saddAsync("snakeworker:grabbed", JSON.stringify(work));

	return work
};

const finish_work = async (work_blob: string) {
	let work = JSON.parse(work);

	// Mark the user.
	if (work.status === "ok") {
		await r.table("users")
			.filter({ accessToken: work.token })
			.update({
				assimilations: r.row("views").default(0).add(1)
			})
			.run(conn);	
	}

	// Delete the work from the grabbed queue.
	// XXX: THIS IS BAD CODE
	let grabbed_work = await redis_client.smembersAsync("snakeworker:grabbed");
	grabbed_work.forEach((grabbed_work_blob) => {
		let grabbed_work = JSON.parse(grabbed_work_blob);

		// Assuming the "primary keys" are by sub ID and user token.
		if (work.sub_id !== grabbed_work.sub_id && work.token != grabbed_work.token) {
			return;
		}

		await redis_client.sremAsync("snakeworker:grabbed", grabbed_work_blob);
	});
}

const routes: Hapi.ServerRoute[] = [
	{
		method: "GET",
		path: "/worker/work",
		async handler(_, h) {
			const query = req.query as Hapi.RequestQuery;
			if (!query.auth) {
				throw Boom.unauthorized("Missing worker auth key.");
			}

			if (query.auth !== config.worker_secret) {
				throw Boom.unauthorized("Incorrect worker auth key.");
			}

			let work = await getWork();

			return work;
		}
	},
	{
		method: "POST",
		path: "/worker/work",
		async handler(_, h) {
			const query = req.payload as any;
			if (!query.auth) {
				throw Boom.unauthorized("Missing worker auth key.");
			}

			if (query.auth !== config.worker_secret) {
				throw Boom.unauthorized("Incorrect worker auth key.");
			}

			if (!query.work_blob) {
				throw Boom.badData("Missing work_blob.");
			}

			await finish_work(query.work_blob);

			return {"status": "ok"};
		}
	}
];

export default () => routes;
