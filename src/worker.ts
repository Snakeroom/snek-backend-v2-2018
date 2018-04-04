import qs from "querystring";
import fetch from "node-fetch";
import config from "./config";
import * as reddit from "./auth/reddit";

console.log(`Worker started up on ${(new Date()).toString()}.`);

const getWork = async () => {
	// XXX: config server host how
	fetch("http://localhost:3000/worker/work", {
		method: "GET",
		body: qs.stringify({
			auth: config.worker_secret
		})
	})
		.then(res => res.json())
		.then(json => {
			if (json.error) {
				console.error(json);
				return;
			}

			return json;
		});
}

const submitWork = (work: object, success: boolean) => {
	// Add the success flag and zip it up for shipping.
	work.success = success;
	let work_blob = JSON.stringify(work);

	// XXX: config server host how
	fetch("http://localhost:3000/worker/work", {
		method: "POST",
		body: qs.stringify({
			auth: config.worker_secret,
			work_blob: work_blob,
			success: success
		})
	})
		.then(res => res.json())
		.then(json => {
			if (json.error) {
				console.error(json);
				return;
			}

			return json;
		});
};

const doWork = () => {
	let work = getWork();

	// Wait more if there is no work for us.
	if (!work) {
		setTimeout(doWork, 6000);
		return;
	}

	// XXX: Handle errors
	reddit.guessKey(work.token, work.sub_id, work.key).then(() => {
		reddit.circleVote(work.token, work.sub_id, 1).then(() => {
			await submitWork(work, true);
		}).catch((e) => {
			console.error(e);
			await submitWork(work, false);
		});
	}).catch((e) => {
		console.error(e);
		await submitWork(work, false);
	});

	// Two seconds because reddit rate limits.
	setTimeout(doWork, 2000);
}

doWork();
