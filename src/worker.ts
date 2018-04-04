import qs from "querystring";
import fetch from "node-fetch";
import config from "./config";
import * as reddit from "./auth/reddit";

console.log(`Worker started up on ${(new Date()).toString()}.`);

const getWork = async () => {
	// XXX: config server host how
	fetch("http://localhost:3000/worker/get_work", {
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

const submitWork = (work_blob: string, success: boolean) => {
	// XXX: config server host how
	fetch("http://localhost:3000/worker/finish_work", {
		method: "GET",
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
	work.success = false;

	// XXX: Handle errors
	reddit.guessKey(work.token, work.sub_id, work.key).then(() => {
		reddit.circleVote(work.token, work.sub_id, 1).then(() => {
			work.success = true;
			await submitWork(JSON.stringify(work));
		}).catch((e) => {
			console.error(e);
			await submitWork(JSON.stringify(work));
		});
	}).catch((e) => {
		console.error(e);
		await submitWork(JSON.stringify(work));
	});;

	// Start the loop again.
	setTimeout(doWork, 2000);
}

doWork();
