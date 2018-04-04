import Hapi from "hapi";
import admin from "./admin";
import auth from "./auth";
import public from "./public";
import worker from "./worker";

export default () =>
	([] as Hapi.ServerRoute[]).concat(
		admin(),
		auth(),
		public(),
		worker()
	);
