import Hapi from "hapi";
import admin from "./admin";
import auth from "./auth";
import public from "./public";

export default () =>
	([] as Hapi.ServerRoute[]).concat(
		admin(),
		auth(),
		public()
	);
