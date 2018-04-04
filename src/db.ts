import bluebird from "bluebird";
import rethinkdb from "rethinkdb";
import redis from "redis";
import config from "./config";

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

export let conn;

export const init = () => {
	return rethinkdb.connect(config.database).then(_conn => {
		conn = _conn;

		const r = rethinkdb.db(config.database.db);
		return Promise.all([
			r.tableCreate("users", { primary_key: "name" }).run(conn),
			r.tableCreate("requests", { primary_key: "name" }).run(conn)
		]).catch(() =>
			console.log("Error while creating table / already exists.")
		);
	});
};

export const redis_client = redis.createClient();
redis_client.on("error", function (err) {
    console.log("[Redis:ERR] " + err);
});

export default rethinkdb;
