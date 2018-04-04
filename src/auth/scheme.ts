import Hapi from "hapi";
import Boom from "boom";
import * as reddit from "./reddit";

export default (() => ({
	async authenticate(req: Hapi.Request, h: Hapi.ResponseToolkit) {
		try {
			const user = await reddit.getUser({
				name: req.yar.get("name")
			});
			if (user) {
				return h.authenticated({
					credentials: {
						user,
						scope: user.scope
					}
				});
			}
		} catch (e) { throw e; }

		throw Boom.unauthorized("Not authorized.");
	}
})) as Hapi.ServerAuthScheme;
