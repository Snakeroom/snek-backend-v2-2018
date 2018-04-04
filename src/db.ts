import rethinkdb from "rethinkdb";
import config from "./config";
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

export default rethinkdb;
